import stripe from "../../config/stripe.js";
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
    const { newBooking, partnerUser } = await prisma.$transaction(async (tx) => {
      // Step 1: Fetch schedule and listing details, locking the row.
      const schedule = await tx.pricingSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          listing: {
            include: {
              promotions: {
                include: { promotion: true },
                where: { promotion: { isActive: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } } },
                orderBy: { promotion: { value: 'desc' } }
              },
              partner: {
                include: {
                  user: true // We need the partner's user info for notifications
                }
              }
            }
          }
        },
      });

      if (!schedule) throw new Error("Pricing schedule not found.");
      if (!schedule.isAvailable) throw new Error("This time slot is no longer available.");

      const { listing } = schedule;
      const partnerUser = listing.partner.user;

      if (!partnerUser) {
        throw new Error("Could not find the partner associated with this listing.");
      }

      const availableSlots = schedule.capacity - schedule.bookedSlots;
      if (numParticipants > availableSlots) {
        throw new Error(`Not enough available slots. Only ${availableSlots} left.`);
      }

      // Optimistically increment booked slots. If partner cancels, we'll decrement.
      await tx.pricingSchedule.update({
        where: { id: scheduleId },
        data: { bookedSlots: { increment: numParticipants } },
      });

      const activePromotion = listing.promotions[0]?.promotion;
      let finalPricePerParticipant = schedule.price;
      if (activePromotion) {
        if (activePromotion.type === 'PERCENTAGE_DISCOUNT') {
          finalPricePerParticipant *= (1 - (activePromotion.value / 100));
        } else if (activePromotion.type === 'FIXED_AMOUNT_DISCOUNT') {
          finalPricePerParticipant -= activePromotion.value;
        }
      }
      const totalPrice = finalPricePerParticipant * numParticipants;


      const newBooking = await tx.booking.create({
        data: {
          userId,
          listingId: listing.id,
          scheduleId,
          numParticipants,
          totalPrice,
          status: "PENDING", // Status is now pending partner approval
        },
      });

      // Create a notification for the partner
      await tx.notification.create({
        data: {
          userId: partnerUser.id,
          type: 'new_booking_request',
          title: `New Booking Request for ${listing.title}`,
          message: `A new booking for ${numParticipants} person(s) is awaiting your approval.`,
          relatedBookingId: newBooking.id,
          relatedListingId: listing.id,
        },
      });


      return { newBooking, partnerUser };
    });

    // --- Notifications (outside transaction) ---
    // 1. Send email to partner
    sendMail({
      to: partnerUser.email,
      subject: `New Booking Request for ${newBooking.listing.title}`,
      html: `
        <h1>New Booking Request</h1>
        <p>You have a new booking request for your listing: <strong>${newBooking.listing.title}</strong>.</p>
        <p>A user has requested a booking for ${newBooking.numParticipants} participant(s).</p>
        <p>Please log in to your dashboard to approve or cancel this reservation.</p>
      `,
    }).catch(err => console.error("Failed to send new booking email to partner:", err));

    // 2. Send socket notification to partner
    const partnerSocketId = userSocketMap[partnerUser.id];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit("new_booking_request", {
        title: `New Booking Request`,
        message: `A new booking for ${newBooking.listing.title} is awaiting your approval.`,
        bookingId: newBooking.id,
      });
    }

    res.status(201).json({
      success: true,
      message: "Reservation request sent to the partner for approval.",
      data: newBooking
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
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        listing: {
          select: { id: true, title: true, address: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
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

      if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
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
        data: { status: "CANCELLED" },
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
      if (currentBooking.status !== 'CONFIRMED') {
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

export const submitPaymentForBooking = async (req, res) => {
  const { id: bookingId } = req.params;
  const { id: userId } = req.user;
  // const { cardNumber, expiryMonth, expiryYear, cvc } = req.body; // Mocked for now

  try {
    const { booking, partner } = await prisma.$transaction(async (tx) => {
      // 1. Validate the booking
      const bookingToPay = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { listing: { include: { partner: true } }, user: true },
      });

      if (!bookingToPay) throw new Error("Booking not found.");
      if (bookingToPay.userId !== userId) throw new Error("You do not have permission to pay for this booking.");
      if (bookingToPay.status !== 'AWAITING_PAYMENT') throw new Error(`Booking is not awaiting payment. Current status: '${bookingToPay.status}'.`);

      // 2. "Process" the payment: Update payment and booking statuses
      await tx.payment.update({
        where: { bookingId: bookingId },
        data: {
          status: 'SUCCEEDED',
          paymentMethodDetails: { cardType: "visa", last4: req.body.cardNumber.slice(-4) },
        },
      });

      const confirmedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
      });

      // 3. Create notifications for both user and partner
      await tx.notification.create({
        data: {
          userId: bookingToPay.userId,
          type: 'BOOKING_CONFIRMED',
          title: `Booking Confirmed: ${bookingToPay.listing.title}`,
          message: `Your payment was successful! Your booking for ${bookingToPay.listing.title} is confirmed.`,
          relatedBookingId: confirmedBooking.id,
          relatedListingId: bookingToPay.listingId,
        },
      });

      await tx.notification.create({
        data: {
          userId: bookingToPay.listing.partner.userId,
          type: 'BOOKING_PAID',
          title: `Payment Received for ${bookingToPay.listing.title}`,
          message: `The user ${bookingToPay.user.fullName} has paid for their booking.`,
          relatedBookingId: confirmedBooking.id,
          relatedListingId: bookingToPay.listingId,
        },
      });

      // --- New: Update daily stats for the booking
      await tx.listingDailyStats.upsert({
        where: {
          listingId_statDate: {
            listingId: confirmedBooking.listingId,
            statDate: new Date(new Date().setHours(0, 0, 0, 0)),
          }
        },
        create: {
          listingId: confirmedBooking.listingId,
          statDate: new Date(new Date().setHours(0, 0, 0, 0)),
          bookingCount: 1,
        },
        update: {
          bookingCount: { increment: 1 },
        },
      });

      return { booking: confirmedBooking, partner: bookingToPay.listing.partner };
    });

    // --- Out-of-transaction notifications ---

    // Notify User of success
    sendMail({
      to: booking.user.email,
      subject: `Booking Confirmed: ${booking.listing.title}!`,
      html: `<h1>Booking Confirmed!</h1><p>Hi ${booking.user.fullName},</p><p>Your payment was successful and your booking for <strong>${booking.listing.title}</strong> is now confirmed.</p><p>Enjoy your activity!</p>`,
    }).catch(err => console.error("Failed to send booking confirmation email:", err));

    const userSocketId = userSocketMap[booking.userId];
    if (userSocketId) {
      io.to(userSocketId).emit("booking_confirmed_notification", {
        type: 'BOOKING_CONFIRMED',
        title: `Booking Confirmed: ${booking.listing.title}!`,
        message: 'Your payment was successful and your booking is confirmed.',
        bookingId: booking.id,
      });
    }

    // Notify Partner of payment
    const partnerSocketId = userSocketMap[partner.userId];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit("booking_paid_notification", {
        type: 'BOOKING_PAID',
        title: `Payment Received for: ${booking.listing.title}`,
        message: `A booking has been paid for and is now confirmed.`,
        bookingId: booking.id,
      });
    }

    res.status(200).json({ success: true, message: "Payment successful. Booking is confirmed." });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
