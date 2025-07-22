import prisma from "../../lib/prisma.js";
import { sendMail } from "../../lib/email.js";
import { io, userSocketMap } from "../../config/socket.js";

export const getPartnerBookings = async (req, res) => {
  const partnerId = req.user.partner?.id;
  const { page, limit, status, listingId } = req.query;

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  const where = {
    listing: {
      partnerId,
      ...(listingId && { id: listingId }),
    },
    ...(status && { status }),
  };

  try {
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
    res.status(500).json({ success: false, message: "Failed to fetch bookings.", error: error.message });
  }
};

export const getPartnerBookingById = async (req, res) => {
  const { id } = req.params;
  const partnerId = req.user.partner?.id;

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        listing: true,
        user: true,
        schedule: true,
      },
    });

    if (!booking || booking.listing.partnerId !== partnerId) {
      return res.status(404).json({ success: false, message: "Booking not found or you do not have permission to view it." });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch booking.", error: error.message });
  }
};

export const createSchedule = async (req, res) => {
  const { listingId } = req.params;
  const partnerId = req.user.partner?.id;
  const scheduleData = req.body;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, partnerId },
    });

    if (!listing) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing or it does not exist." });
    }

    const newSchedule = await prisma.pricingSchedule.create({
      data: {
        listingId,
        ...scheduleData,
      },
    });

    res.status(201).json({ success: true, data: newSchedule });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A schedule for this listing at the specified start time already exists.' });
    }
    res.status(500).json({ success: false, message: "Failed to create schedule.", error: error.message });
  }
};

export const getSchedulesForListing = async (req, res) => {
  const { listingId } = req.params;
  const partnerId = req.user.partner?.id;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, partnerId },
    });

    if (!listing) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing or it does not exist." });
    }

    const schedules = await prisma.pricingSchedule.findMany({
      where: { listingId },
      orderBy: { startTime: 'asc' },
    });

    res.status(200).json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch schedules.", error: error.message });
  }
};

export const updateSchedule = async (req, res) => {
  const { scheduleId } = req.params;
  const partnerId = req.user.partner?.id;
  const updateData = req.body;

  try {
    const schedule = await prisma.pricingSchedule.findFirst({
      where: {
        id: scheduleId,
        listing: { partnerId },
      },
    });

    if (!schedule) {
      return res.status(403).json({ success: false, message: "Schedule not found or you do not have permission to update it." });
    }

    const updatedSchedule = await prisma.pricingSchedule.update({
      where: { id: scheduleId },
      data: updateData,
    });

    res.status(200).json({ success: true, data: updatedSchedule });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A schedule for this listing at the specified start time already exists.' });
    }
    res.status(500).json({ success: false, message: "Failed to update schedule.", error: error.message });
  }
};

export const deleteSchedule = async (req, res) => {
  const { scheduleId } = req.params;
  const partnerId = req.user.partner?.id;

  try {
    const schedule = await prisma.pricingSchedule.findFirst({
      where: {
        id: scheduleId,
        listing: { partnerId },
      },
    });

    if (!schedule) {
      return res.status(403).json({ success: false, message: "Schedule not found or you do not have permission to delete it." });
    }

    await prisma.pricingSchedule.delete({
      where: { id: scheduleId },
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete schedule.", error: error.message });
  }
};

export const getPartnerDashboardStats = async (req, res) => {
  const partnerId = req.user.partner?.id;
  const { startDate, endDate } = req.query;

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  const dateFilter = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate && { lte: new Date(endDate) }),
  };

  const hasDateFilter = startDate || endDate;

  try {
    const [totalRevenueResult, bookingsByStatus, totalListings, totalReviews, reviewsAwaitingReply] = await Promise.all([
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: {
          listing: { partnerId },
          status: 'completed',
          ...(hasDateFilter && { createdAt: dateFilter }),
        },
      }),
      prisma.booking.groupBy({
        by: ['status'],
        _count: { id: true },
        where: {
          listing: { partnerId },
          ...(hasDateFilter && { createdAt: dateFilter }),
        },
      }),
      prisma.listing.count({
        where: { partnerId },
      }),
      prisma.review.count({
        where: {
          listing: { partnerId },
          ...(hasDateFilter && { createdAt: dateFilter }),
        },
      }),
      prisma.review.count({
        where: {
          listing: { partnerId },
          partnerReply: null,
          ...(hasDateFilter && { createdAt: dateFilter }),
        },
      }),
    ]);


    // Format stats for a clean response
    const stats = {
      totalRevenue: totalRevenueResult._sum.totalPrice || 0,
      totalListings,
      bookings: {
        total: bookingsByStatus.reduce((acc, curr) => acc + curr._count.id, 0),
        confirmed: bookingsByStatus.find(b => b.status === 'confirmed')?._count.id || 0,
        completed: bookingsByStatus.find(b => b.status === 'completed')?._count.id || 0,
        cancelled: bookingsByStatus.find(b => b.status === 'cancelled')?._count.id || 0,
      },
      reviews: {
        total: totalReviews,
        awaitingReply: reviewsAwaitingReply
      }
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("Failed to fetch partner stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch dashboard stats." });
  }
};

export const cancelReservationByPartner = async (req, res) => {
  const { id: bookingId } = req.params;
  const partnerId = req.user.partner?.id;

  try {
    const { booking, userEmail, userFullName, userId } = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { listing: true, user: { select: { email: true, fullName: true, id: true } } },
      });

      if (!booking) throw new Error("Booking not found.");
      if (booking.listing.partnerId !== partnerId) {
        throw new Error("You do not have permission to cancel this booking.");
      }
      if (booking.status === "cancelled" || booking.status === "completed") {
        throw new Error(`Booking cannot be cancelled as it is already ${booking.status}.`);
      }

      await tx.pricingSchedule.update({
        where: { id: booking.scheduleId },
        data: { bookedSlots: { decrement: booking.numParticipants } },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "cancelled" },
      });

      await tx.notification.create({
        data: {
          userId: booking.userId,
          type: 'booking_cancelled_by_partner',
          title: `Booking Cancelled: ${booking.listing.title}`,
          message: `Your booking for ${booking.listing.title} on ${new Date(booking.schedule.startTime).toLocaleString()} was cancelled by the host.`,
          relatedBookingId: booking.id,
          relatedListingId: booking.listingId,
        },
      });

      return { booking, userEmail: booking.user.email, userFullName: booking.user.fullName, userId: booking.user.id };
    });

    sendMail({
      to: userEmail,
      subject: `Your Booking for ${booking.listing.title} Has Been Cancelled`,
      html: `<h1>Booking Cancellation</h1><p>Hi ${userFullName},</p><p>We are writing to inform you that your booking for <strong>${booking.listing.title}</strong> on ${new Date(booking.schedule.startTime).toLocaleString()} has been cancelled by the host.</p>`,
    }).catch(err => console.error("Failed to send cancellation email:", err));

    const receiverSocketId = userSocketMap[userId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("booking_cancelled_notification", {
        title: `Booking Cancelled: ${booking.listing.title}`,
        message: `Your booking for ${new Date(booking.schedule.startTime).toLocaleString()} was cancelled by the host.`,
        bookingId: booking.id,
      });
    }

    res.status(200).json({ success: true, message: "Booking cancelled successfully." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const approveReservationByPartner = async (req, res) => {
  const { id: bookingId } = req.params;
  const partnerId = req.user.partner?.id;

  try {
    const { booking, user } = await prisma.$transaction(async (tx) => {
      const bookingToApprove = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          listing: true,
          user: true,
        },
      });

      if (!bookingToApprove) throw new Error("Booking not found.");
      if (bookingToApprove.listing.partnerId !== partnerId) {
        throw new Error("You do not have permission to approve this booking.");
      }
      if (bookingToApprove.status !== 'pending') {
        throw new Error(`Only pending bookings can be approved. This booking is currently '${bookingToApprove.status}'.`);
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: "awaiting_payment" },
      });

      await tx.payment.create({
        data: {
          bookingId: updatedBooking.id,
          userId: bookingToApprove.userId,
          amount: updatedBooking.totalPrice,
          currency: "MAD", // Assuming MAD, adjust if dynamic
          status: 'pending',
          paymentGateway: 'system', // Indicates internal system payment
          gatewayTransactionId: `mock_${updatedBooking.id}_${Date.now()}` // Mock ID
        }
      });

      await tx.notification.create({
        data: {
          userId: bookingToApprove.userId,
          type: 'booking_approved_for_payment',
          title: `Action Required: Your booking for ${bookingToApprove.listing.title} is approved!`,
          message: `Your booking is approved and is now awaiting payment. Please complete the payment to confirm your spot.`,
          relatedBookingId: updatedBooking.id,
          relatedListingId: bookingToApprove.listingId,
        },
      });

      return { booking: updatedBooking, user: bookingToApprove.user };
    });

    const paymentLink = `${process.env.FRONTEND_URL}/payment?booking_id=${booking.id}`;

    sendMail({
      to: user.email,
      subject: `Your Booking for ${booking.listing.title} is Approved!`,
      html: `<h1>Booking Approved & Awaiting Payment</h1><p>Hi ${user.fullName},</p><p>Great news! Your booking for <strong>${booking.listing.title}</strong> has been approved by the host.</p><p>To confirm your reservation, please complete the payment by clicking the link below:</p><a href="${paymentLink}" target="_blank">Pay Now</a>`,
    }).catch(err => console.error("Failed to send approval email:", err));

    const receiverSocketId = userSocketMap[user.id];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("booking_approved_notification", {
        type: 'booking_approved_for_payment',
        title: `Your booking for ${booking.listing.title} is approved!`,
        message: 'Please complete the payment to confirm your spot.',
        bookingId: booking.id,
        paymentLink: paymentLink
      });
    }

    res.status(200).json({ success: true, message: "Booking approved and user has been notified to complete payment." });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createPromotion = async (req, res) => {
  const partnerId = req.user.partner?.id;
  const promotionData = req.body;

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  try {
    const newPromotion = await prisma.promotion.create({
      data: {
        partnerId,
        ...promotionData,
      },
    });
    res.status(201).json({ success: true, data: newPromotion });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create promotion.", error: error.message });
  }
};

export const getPromotions = async (req, res) => {
  const partnerId = req.user.partner?.id;

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  try {
    const promotions = await prisma.promotion.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, data: promotions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch promotions.", error: error.message });
  }
};

export const applyPromotionToListings = async (req, res) => {
  const { promotionId } = req.params;
  const { listingIds } = req.body;
  const partnerId = req.user.partner?.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify the promotion exists and belongs to the partner.
      const promotion = await tx.promotion.findFirst({
        where: { id: promotionId, partnerId },
      });
      if (!promotion) {
        throw new Error("Promotion not found or you do not have permission to use it.");
      }

      // 2. Verify all listings exist and belong to the partner.
      const listings = await tx.listing.findMany({
        where: {
          id: { in: listingIds },
          partnerId,
        },
        select: { id: true },
      });

      if (listings.length !== listingIds.length) {
        throw new Error("One or more listings were not found or do not belong to you.");
      }

      // 3. Create the associations.
      const dataToInsert = listingIds.map(listingId => ({
        promotionId,
        listingId,
      }));

      await tx.listingPromotion.createMany({
        data: dataToInsert,
        skipDuplicates: true, // Prevents errors if a promotion is already applied
      });

      return { count: listingIds.length };
    });

    res.status(200).json({ success: true, message: `Successfully applied promotion to ${result.count} listings.` });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getListingPerformanceStats = async (req, res) => {
  const { listingId } = req.params;
  const { startDate, endDate } = req.query;
  const partnerId = req.user.partner?.id;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, partnerId },
      select: { id: true }
    });

    if (!listing) {
      return res.status(403).json({ success: false, message: "Listing not found or you do not have permission to view its stats." });
    }

    const stats = await prisma.listingDailyStats.findMany({
      where: {
        listingId,
        statDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        }
      },
      orderBy: {
        statDate: 'asc'
      }
    });

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch listing performance stats.", error: error.message });
  }
}; 