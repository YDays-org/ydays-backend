import prisma from "../../lib/prisma.js";
import { startOfDay, endOfDay } from "date-fns";
import { sendMail } from "../../lib/email.js";
import { io, userSocketMap } from "../../config/socket.js";

export const getAvailability = async (req, res) => {
  const { listingId, date } = req.query;

  const startDate = startOfDay(new Date(date));
  const endDate = endOfDay(new Date(date));

  try {
    const schedules = await prisma.pricingSchedule.findMany({
      where: {
        listingId,
        isAvailable: true,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        price: true,
        capacity: true,
        bookedSlots: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // Calculate available slots for each schedule
    const availability = schedules.map((schedule) => ({
      ...schedule,
      availableSlots: schedule.capacity - schedule.bookedSlots,
    }));

    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch availability.", error: error.message });
  }
};

export const createReservation = async (req, res) => {
  const { scheduleId, numParticipants } = req.body;
  const { id: userId } = req.user;

  try {
    const { booking } = await prisma.$transaction(async (tx) => {
      // Step 1: Fetch schedule and listing details, locking the row.
      const schedule = await tx.pricingSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          listing: {
            include: {
              promotions: {
                include: { promotion: true },
                where: { promotion: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } } },
                orderBy: { promotion: { value: 'desc' } } // A simple heuristic for "best" promotion
              }
            }
          }
        },
      });

      if (!schedule) throw new Error("Pricing schedule not found.");
      if (!schedule.isAvailable) throw new Error("This time slot is no longer available.");

      const { listing } = schedule; // Extract listing to avoid TS property warning

      const availableSlots = schedule.capacity - schedule.bookedSlots;
      if (numParticipants > availableSlots) {
        throw new Error(`Not enough available slots. Only ${availableSlots} left.`);
      }

      // Step 2: Calculate final price with active promotion
      const activePromotion = listing.promotions[0]?.promotion;
      let finalPricePerParticipant = schedule.price;
      if (activePromotion) {
        if (activePromotion.type === 'PERCENTAGE_DISCOUNT') {
          finalPricePerParticipant *= (1 - activePromotion.value / 100);
        } else if (activePromotion.type === 'FIXED_AMOUNT_DISCOUNT') {
          finalPricePerParticipant -= activePromotion.value;
        }
      }
      const totalPrice = finalPricePerParticipant * numParticipants;

      // Step 3: Update booked slots
      await tx.pricingSchedule.update({
        where: { id: scheduleId },
        data: { bookedSlots: { increment: numParticipants } },
      });

      // Step 4: Create a PENDING booking
      const newBooking = await tx.booking.create({
        data: {
          userId,
          listingId: schedule.listingId,
          scheduleId,
          numParticipants,
          totalPrice,
          status: "pending", // STATUS IS NOW PENDING
        },
      });

      // Step 5: Create a PENDING payment record
      // In a real app, this would use an ID from Stripe/PayPal
      const gatewayTransactionId = `simulated_${newBooking.id}`;
      await tx.payment.create({
        data: {
          bookingId: newBooking.id,
          userId,
          amount: totalPrice,
          currency: schedule.currency,
          status: 'pending',
          paymentGateway: 'simulated',
          gatewayTransactionId,
        }
      });

      return { booking: newBooking, listing, schedule };
    });

    res.status(201).json({
      success: true,
      message: "Reservation created and is pending payment. Complete payment to confirm.",
      data: booking
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getReservations = async (req, res) => {
  const { id: userId } = req.user;
  const { page, limit, status } = req.query;

  const where = {
    userId,
    ...(status && { status }),
  };

  try {
    const parsedLimit = parseInt(limit, 10) || 20; // Default to 20 if limit is invalid
    const parsedPage = parseInt(page, 10) || 1; // Default to page 1 if invalid
    const skip = (parsedPage - 1) * parsedLimit; // Calculate skip value

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        listing: {
          select: { id: true, title: true },
        },
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
      skip, // Ensure skip is always passed
      take: parsedLimit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = await prisma.booking.count({ where });

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reservations.", error: error.message });
  }
};

export const getReservationById = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        listing: true,
        schedule: true,
      },
    });

    if (!booking || booking.userId !== userId) {
      return res.status(404).json({ success: false, message: "Booking not found or you do not have permission to view it." });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reservation.", error: error.message });
  }
};

export const cancelReservation = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (!booking || booking.userId !== userId) {
        throw new Error("Booking not found or you do not have permission to cancel it.");
      }

      if (booking.status === "cancelled" || booking.status === "completed") {
        throw new Error(`Booking cannot be cancelled as it is already ${booking.status}.`);
      }

      // Restore the booked slots
      await tx.pricingSchedule.update({
        where: { id: booking.scheduleId },
        data: {
          bookedSlots: {
            decrement: booking.numParticipants,
          },
        },
      });

      // Update the booking status
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: { status: "cancelled" },
      });

      return cancelledBooking;
    });

    res.status(200).json({ success: true, message: "Booking cancelled successfully.", data: updatedBooking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateReservation = async (req, res) => {
  const { id: bookingId } = req.params;
  const { numParticipants: newNumParticipants } = req.body;
  const { id: userId } = req.user;

  try {
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // 1. Get the current booking and schedule details, locking them for the transaction.
      const currentBooking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          schedule: {
            include: {
              listing: {
                include: {
                  promotions: {
                    include: { promotion: true },
                    where: { promotion: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } } },
                    orderBy: { promotion: { value: 'desc' } }
                  }
                }
              }
            }
          }
        },
      });

      // 2. Perform authorization and validation checks.
      if (!currentBooking) {
        throw new Error("Booking not found.");
      }
      if (currentBooking.userId !== userId) {
        throw new Error("You do not have permission to modify this booking.");
      }
      if (currentBooking.status !== 'confirmed') {
        throw new Error(`Cannot modify a booking with status '${currentBooking.status}'.`);
      }

      // 3. Calculate the change in participants and check against schedule capacity.
      const participantChange = newNumParticipants - currentBooking.numParticipants;

      if (participantChange > 0) { // If adding more participants
        const availableSlots = currentBooking.schedule.capacity - currentBooking.schedule.bookedSlots;
        if (participantChange > availableSlots) {
          throw new Error(`Not enough available slots. Only ${availableSlots} more slots are available.`);
        }
      }

      // 4. Update the booked slots count on the pricing schedule.
      await tx.pricingSchedule.update({
        where: { id: currentBooking.scheduleId },
        data: { bookedSlots: { increment: participantChange } },
      });

      // 5. Update the booking with the new participant count and total price, considering promotions.
      const activePromotion = currentBooking.schedule.listing.promotions[0]?.promotion;
      let finalPricePerParticipant = currentBooking.schedule.price;
      if (activePromotion) {
        if (activePromotion.type === 'PERCENTAGE_DISCOUNT') {
          finalPricePerParticipant *= (1 - activePromotion.value / 100);
        } else if (activePromotion.type === 'FIXED_AMOUNT_DISCOUNT') {
          finalPricePerParticipant -= activePromotion.value;
        }
      }
      const newTotalPrice = finalPricePerParticipant * newNumParticipants;

      const finalBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          numParticipants: newNumParticipants,
          totalPrice: newTotalPrice,
        },
      });

      return finalBooking;
    });

    res.status(200).json({ success: true, message: "Booking updated successfully.", data: updatedBooking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const handlePaymentWebhook = async (req, res) => {
  const { gatewayTransactionId, status: paymentStatus } = req.body;

  // In a real application, you would first verify the webhook signature
  // to ensure it's a legitimate request from your payment provider.

  if (paymentStatus !== 'succeeded') {
    // Optionally handle failed payments here, e.g., by cancelling the booking
    // and restoring the capacity. For now, we just acknowledge and return.
    console.log(`Received non-successful payment status for ${gatewayTransactionId}. Status: ${paymentStatus}`);
    return res.status(200).send();
  }

  try {
    const { booking, user, listing, schedule } = await prisma.$transaction(async (tx) => {
      // 1. Find the payment record.
      const payment = await tx.payment.findUnique({
        where: { gatewayTransactionId },
        include: { booking: true }
      });

      if (!payment) throw new Error("Payment record not found.");
      if (payment.booking.status !== 'pending') {
        console.log(`Booking ${payment.bookingId} is already processed. Status: ${payment.booking.status}`);
        return { booking: null }; // Gracefully exit if already handled.
      }

      // 2. Update payment and booking statuses.
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'succeeded' },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'confirmed' },
        include: {
          user: true,
          listing: true,
          schedule: true,
        },
      });

      // 3. Create the persistent notification.
      await tx.notification.create({
        data: {
          userId: updatedBooking.userId,
          type: 'booking_confirmed',
          title: `Booking Confirmed: ${updatedBooking.listing.title}`,
          message: `Your booking for ${updatedBooking.listing.title} on ${new Date(updatedBooking.schedule.startTime).toLocaleString()} is confirmed.`,
          relatedBookingId: updatedBooking.id,
          relatedListingId: updatedBooking.listingId,
        },
      });

      return {
        booking: updatedBooking,
        user: updatedBooking.user,
        listing: updatedBooking.listing,
        schedule: updatedBooking.schedule
      };
    });

    if (!booking) {
      return res.status(200).json({ success: true, message: "Webhook for an already processed booking received." });
    }

    // --- Post-Transaction Side Effects (Moved from createReservation) ---
    sendMail({
      to: user.email,
      subject: `Your Booking for ${listing.title} is Confirmed!`,
      html: `<h1>Booking Confirmation</h1><p>Hi ${user.fullName},</p><p>Your booking for <strong>${listing.title}</strong> on ${new Date(schedule.startTime).toLocaleString()} is confirmed.</p>`,
    }).catch(err => console.error("Failed to send booking confirmation email:", err));

    const receiverSocketId = userSocketMap[user.id];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("new_booking_notification", {
        title: `Booking Confirmed: ${listing.title}`,
        message: `Your booking for ${new Date(schedule.startTime).toLocaleString()} is confirmed.`,
        bookingId: booking.id,
      });
    }

    res.status(200).json({ success: true, message: "Webhook processed successfully." });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
