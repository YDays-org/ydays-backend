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
    const { booking, clientSecret } = await prisma.$transaction(async (tx) => {
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
              }
            }
          }
        },
      });

      if (!schedule) throw new Error("Pricing schedule not found.");
      if (!schedule.isAvailable) throw new Error("This time slot is no longer available.");

      const { listing } = schedule;

      const availableSlots = schedule.capacity - schedule.bookedSlots;
      if (numParticipants > availableSlots) {
        throw new Error(`Not enough available slots. Only ${availableSlots} left.`);
      }

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

      await tx.pricingSchedule.update({
        where: { id: scheduleId },
        data: { bookedSlots: { increment: numParticipants } },
      });

      const newBooking = await tx.booking.create({
        data: {
          userId,
          listingId: listing.id,
          scheduleId,
          numParticipants,
          totalPrice,
          status: "pending",
        },
      });

      let clientSecret = null;
      let gatewayTransactionId;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalPrice * 100),
        currency: schedule.currency.toLowerCase(),
        metadata: { bookingId: newBooking.id, userId },
      });
      clientSecret = paymentIntent.client_secret;
      gatewayTransactionId = paymentIntent.id;

      await tx.payment.create({
        data: {
          bookingId: newBooking.id,
          userId,
          amount: totalPrice,
          currency: schedule.currency,
          status: 'pending',
          paymentGateway: 'stripe',
          gatewayTransactionId,
        }
      });

      return { booking: newBooking, clientSecret };
    });

    res.status(201).json({
      success: true,
      message: "Reservation created and is pending payment.",
      data: {
        booking,
        paymentInfo: {
          clientSecret,
        },
      }
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

const _confirmBooking = async (gatewayTransactionId) => {
  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { gatewayTransactionId },
      include: { booking: true }
    });

    if (!payment) throw new Error("Payment record not found.");
    if (payment.booking.status !== 'pending') {
      console.log(`Booking ${payment.bookingId} is already processed.`);
      return { booking: null };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'succeeded' },
    });

    const updatedBooking = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: 'confirmed' },
      include: { user: true, listing: true, schedule: true },
    });

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
    return { booking: updatedBooking, user: updatedBooking.user, listing: updatedBooking.listing, schedule: updatedBooking.schedule };
  });
};

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    try {
      const { booking, user, listing, schedule } = await _confirmBooking(paymentIntent.id);
      if (booking) {
        // Post-confirmation side effects
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
      }
    } catch (error) {
      console.error(`Failed to confirm booking for Stripe paymentIntent ${paymentIntent.id}:`, error);
      return res.status(500).json({ error: "Failed to process webhook." });
    }
  }

  res.status(200).json({ received: true });
};
