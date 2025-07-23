import prisma from "../../lib/prisma.js";
import { startOfDay, endOfDay } from "date-fns";
import { sendMail } from "../../lib/email.js";
import { io, userSocketMap } from "../../config/socket.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Fetch schedule and listing details with locking
      const schedule = await tx.pricingSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          listing: {
            include: {
              promotions: {
                include: { promotion: true },
                where: { 
                  promotion: { 
                    isActive: true, 
                    startDate: { lte: new Date() }, 
                    endDate: { gte: new Date() } 
                  } 
                },
                orderBy: { promotion: { value: 'desc' } }
              },
              partner: {
                include: { user: true }
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

      // Step 2: Check availability
      const availableSlots = schedule.capacity - schedule.bookedSlots;
      if (numParticipants > availableSlots) {
        throw new Error(`Not enough available slots. Only ${availableSlots} left.`);
      }

      // Step 3: Calculate pricing with promotions
      const activePromotion = listing.promotions[0]?.promotion;
      let finalPricePerParticipant = schedule.price;
      if (activePromotion) {
        if (activePromotion.type === 'PERCENTAGE_DISCOUNT') {
          finalPricePerParticipant = schedule.price * (1 - (activePromotion.value / 100));
        } else if (activePromotion.type === 'FIXED_AMOUNT_DISCOUNT') {
          finalPricePerParticipant = schedule.price - activePromotion.value;
        }
      }
      const totalPrice = finalPricePerParticipant * numParticipants;

      // Step 4: Update pricing schedule (reserve slots)
      await tx.pricingSchedule.update({
        where: { id: scheduleId },
        data: { bookedSlots: { increment: numParticipants } },
      });

      // Step 5: Create booking record
      const newBooking = await tx.booking.create({
        data: {
          userId,
          listingId: listing.id,
          scheduleId,
          numParticipants,
          totalPrice,
          status: totalPrice > 0 ? "awaiting_payment" : "confirmed", // Free bookings auto-confirm
        },
        include: {
          listing: {
            select: { id: true, title: true, partner: { select: { userId: true } } }
          },
          user: {
            select: { id: true, fullName: true, email: true }
          }
        }
      });

      // Step 6: Create payment record (if payment required)
      let paymentRecord = null;
      if (totalPrice > 0) {
        paymentRecord = await tx.payment.create({
          data: {
            bookingId: newBooking.id,
            userId,
            amount: totalPrice,
            currency: schedule.currency || 'MAD',
            status: 'pending',
            paymentGateway: 'stripe',
            gatewayTransactionId: `pending_${newBooking.id}` // Will be updated with actual Stripe ID
          }
        });
      }

      // Step 7: Create notifications
      const notificationType = totalPrice > 0 ? 'new_booking_request' : 'booking_confirmed';
      const notificationMessage = totalPrice > 0 
        ? `A new booking for ${numParticipants} person(s) is awaiting payment and approval.`
        : `A new free booking for ${numParticipants} person(s) has been confirmed.`;

      // Notification for partner
      await tx.notification.create({
        data: {
          userId: partnerUser.id,
          type: notificationType,
          title: `New Booking Request for ${listing.title}`,
          message: notificationMessage,
          relatedBookingId: newBooking.id,
          relatedListingId: listing.id,
        },
      });

      // Notification for user (if free booking)
      if (totalPrice === 0) {
        await tx.notification.create({
          data: {
            userId: newBooking.userId,
            type: 'booking_confirmed',
            title: `Booking Confirmed: ${listing.title}`,
            message: `Your free booking for ${listing.title} has been confirmed.`,
            relatedBookingId: newBooking.id,
            relatedListingId: listing.id,
          },
        });

        // Update daily stats for free confirmed bookings
        await tx.listingDailyStats.upsert({
          where: {
            listingId_statDate: {
              listingId: newBooking.listingId,
              statDate: new Date(new Date().setHours(0, 0, 0, 0)),
            }
          },
          create: {
            listingId: newBooking.listingId,
            statDate: new Date(new Date().setHours(0, 0, 0, 0)),
            bookingCount: 1,
          },
          update: {
            bookingCount: { increment: 1 },
          },
        });
      }

      return { 
        newBooking, 
        partnerUser, 
        paymentRecord, 
        requiresPayment: totalPrice > 0,
        totalPrice 
      };
    });

    // Step 8: Send notifications outside transaction
    const { newBooking, partnerUser, requiresPayment, totalPrice } = result;

    // Email to partner
    const emailSubject = requiresPayment 
      ? `New Booking Request for ${newBooking.listing.title}`
      : `New Booking Confirmed for ${newBooking.listing.title}`;
    
    const emailMessage = requiresPayment
      ? `A user has requested a booking for ${newBooking.numParticipants} participant(s) and needs to complete payment.`
      : `A user has confirmed a free booking for ${newBooking.numParticipants} participant(s).`;

    sendMail({
      to: partnerUser.email,
      subject: emailSubject,
      html: `
        <h1>${emailSubject}</h1>
        <p>${emailMessage}</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li>Listing: ${newBooking.listing.title}</li>
          <li>Participants: ${newBooking.numParticipants}</li>
          <li>Total Price: ${totalPrice} MAD</li>
          <li>Status: ${newBooking.status}</li>
        </ul>
        <p>Please log in to your dashboard to manage this booking.</p>
      `,
    }).catch(err => console.error("Failed to send booking email to partner:", err));

    // Socket notification to partner
    const partnerSocketId = userSocketMap[partnerUser.id];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit("new_booking_request", {
        title: emailSubject,
        message: emailMessage,
        bookingId: newBooking.id,
        requiresPayment,
        totalPrice
      });
    }

    // Response based on payment requirement
    if (requiresPayment) {
      res.status(201).json({
        success: true,
        message: "Booking created successfully. Please complete payment to confirm.",
        data: {
          booking: newBooking,
          requiresPayment: true,
          totalPrice: totalPrice,
          paymentStatus: 'pending'
        }
      });
    } else {
      res.status(201).json({
        success: true,
        message: "Free booking confirmed successfully.",
        data: {
          booking: newBooking,
          requiresPayment: false,
          totalPrice: 0,
          paymentStatus: 'not_required'
        }
      });
    }

  } catch (error) {
    console.error("Booking creation error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getReservations = async (req, res) => {
  // Check if user is authenticated
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required. User not found in request." 
    });
  }

  const { id: userId } = req.user;
  const { page, limit, status } = req.query;

  console.log('getReservations called for user:', userId, 'with params:', { page, limit, status });

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
          select: { 
            id: true, 
            title: true, 
            address: true,
            media: {
              select: {
                mediaUrl: true,
                isCover: true
              },
              where: { isCover: true },
              take: 1
            }
          },
        },
        user: {
          select: { id: true, fullName: true, email: true },
        },
        review: {
          select: { id: true }
        }
      },
      skip, // Ensure skip is always passed
      take: parsedLimit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = await prisma.booking.count({ where });

    // Transform bookings to match frontend expectations
    const transformedBookings = bookings.map(booking => ({
      ...booking,
      totalAmount: booking.totalPrice, // Map totalPrice to totalAmount
      reviewed: !!booking.review, // Add reviewed status based on review existence
    }));

    res.status(200).json({
      success: true,
      data: transformedBookings,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reservations.", error: error.message });
  }
};

export const getAllReservations = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        listing: true,
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch all reservations.", error: error.message });
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
      if (bookingToPay.status !== 'awaiting_payment') throw new Error(`Booking is not awaiting payment. Current status: '${bookingToPay.status}'.`);

      // 2. "Process" the payment: Update payment and booking statuses
      await tx.payment.update({
        where: { bookingId: bookingId },
        data: {
          status: 'succeeded',
          paymentMethodDetails: { cardType: "visa", last4: req.body.cardNumber.slice(-4) },
        },
      });

      const confirmedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed' },
      });

      // 3. Create notifications for both user and partner
      await tx.notification.create({
        data: {
          userId: bookingToPay.userId,
          type: 'booking_confirmed',
          title: `Booking Confirmed: ${bookingToPay.listing.title}`,
          message: `Your payment was successful! Your booking for ${bookingToPay.listing.title} is confirmed.`,
          relatedBookingId: confirmedBooking.id,
          relatedListingId: bookingToPay.listingId,
        },
      });

      await tx.notification.create({
        data: {
          userId: bookingToPay.listing.partner.userId,
          type: 'booking_paid',
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
        type: 'booking_confirmed',
        title: `Booking Confirmed: ${booking.listing.title}!`,
        message: 'Your payment was successful and your booking is confirmed.',
        bookingId: booking.id,
      });
    }

    // Notify Partner of payment
    const partnerSocketId = userSocketMap[partner.userId];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit("booking_paid_notification", {
        type: 'booking_paid',
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

export const processPayment = async (req, res) => {
  const { amount, currency } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // Amount in cents
      currency, // e.g., 'usd'
      payment_method_types: ['card'],
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create payment intent.",
      error: error.message,
    });
  }
};

// New payment completion handler for Stripe integration
export const completePayment = async (req, res) => {
  const { bookingId, paymentIntentId, paymentMethodDetails } = req.body;
  const { id: userId } = req.user;

  try {
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment was not successful' 
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate the booking
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { 
          listing: { 
            include: { 
              partner: { include: { user: true } } 
            } 
          }, 
          user: true,
          payment: true
        },
      });

      if (!booking) throw new Error("Booking not found.");
      if (booking.userId !== userId) throw new Error("Unauthorized to complete this payment.");
      if (booking.status !== 'awaiting_payment') {
        throw new Error(`Cannot complete payment for booking with status: ${booking.status}`);
      }

      // 2. Update payment record
      await tx.payment.update({
        where: { bookingId: bookingId },
        data: {
          status: 'succeeded',
          gatewayTransactionId: paymentIntentId,
          paymentMethodDetails: paymentMethodDetails || {
            brand: paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.brand || 'unknown',
            last4: paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.last4 || 'xxxx',
            exp_month: paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.exp_month || 12,
            exp_year: paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.exp_year || 2025
          },
          updatedAt: new Date()
        },
      });

      // 3. Update booking status
      const confirmedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'confirmed' },
      });

      // 4. Create confirmation notifications
      // For user
      await tx.notification.create({
        data: {
          userId: booking.userId,
          type: 'booking_confirmed',
          title: `Booking Confirmed: ${booking.listing.title}`,
          message: `Your payment was successful! Your booking for ${booking.listing.title} is confirmed.`,
          relatedBookingId: confirmedBooking.id,
          relatedListingId: booking.listingId,
        },
      });

      // For partner
      await tx.notification.create({
        data: {
          userId: booking.listing.partner.userId,
          type: 'booking_paid',
          title: `Payment Received for ${booking.listing.title}`,
          message: `${booking.user.fullName} has completed payment for their booking.`,
          relatedBookingId: confirmedBooking.id,
          relatedListingId: booking.listingId,
        },
      });

      // 5. Update listing daily stats
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

      return { 
        booking: confirmedBooking, 
        partner: booking.listing.partner,
        user: booking.user,
        listing: booking.listing
      };
    });

    // 6. Send success notifications outside transaction
    const { booking, partner, user, listing } = result;

    // Email to user
    sendMail({
      to: user.email,
      subject: `Booking Confirmed: ${listing.title}`,
      html: `
        <h1>Booking Confirmed!</h1>
        <p>Hi ${user.fullName},</p>
        <p>Your payment was successful and your booking for <strong>${listing.title}</strong> is now confirmed.</p>
        <p><strong>Booking Details:</strong></p>
        <ul>
          <li>Participants: ${booking.numParticipants}</li>
          <li>Total Paid: ${booking.totalPrice} MAD</li>
          <li>Status: Confirmed</li>
        </ul>
        <p>We look forward to seeing you!</p>
      `,
    }).catch(err => console.error("Failed to send confirmation email to user:", err));

    // Socket notifications
    const userSocketId = userSocketMap[user.id];
    if (userSocketId) {
      io.to(userSocketId).emit("booking_confirmed", {
        title: `Booking Confirmed: ${listing.title}`,
        message: 'Your payment was successful and your booking is confirmed.',
        bookingId: booking.id,
        status: 'confirmed'
      });
    }

    const partnerSocketId = userSocketMap[partner.userId];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit("booking_paid", {
        title: `Payment Received for ${listing.title}`,
        message: `${user.fullName} has completed payment for their booking.`,
        bookingId: booking.id,
        amount: booking.totalPrice
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment completed successfully. Booking confirmed.",
      data: {
        booking: booking,
        paymentStatus: 'succeeded',
        bookingStatus: 'confirmed'
      }
    });

  } catch (error) {
    console.error("Payment completion error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};
