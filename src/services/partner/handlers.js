import prisma from "../../lib/prisma.js";
import { sendMail } from "../../lib/email.js";
import { io, userSocketMap } from "../../config/socket.js";

export const getPartnerBookings = async (req, res) => {
  const partnerId = req.user?.id;
  const { page = 1, limit = 10, status, listingId } = req.query;

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
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

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
      skip,
      take,
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalFromDb = await prisma.booking.count({ where });
    const total = Number(totalFromDb);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch bookings.", error: error.message });
  }
};

export const getPartnerBookingById = async (req, res) => {
  const { id } = req.params;
  const partnerId = req.user?.id;

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
  const partnerId = req.user?.id;
  const scheduleData = req.body;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, partnerId },
    });

    if (!listing) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing or it does not exist." });
    }

    const newSchedule = await prisma.$transaction(async (tx) => {
      const schedule = await tx.pricingSchedule.create({
        data: {
          listingId,
          ...scheduleData,
        },
      });

      // Business Logic: Auto-publish listing when first schedule is added
      if (listing.status === 'DRAFT') {
        await tx.listing.update({
          where: { id: listingId },
          data: { status: 'PUBLISHED' },
        });
      }

      return schedule;
    });

    res.status(201).json({
      success: true,
      data: newSchedule,
      message: listing.status === 'DRAFT' ? 'Schedule created and listing published!' : 'Schedule created successfully!'
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A schedule for this listing at the specified start time already exists.' });
    }
    res.status(500).json({ success: false, message: "Failed to create schedule.", error: error.message });
  }
};

export const getSchedulesForListing = async (req, res) => {
  const { listingId } = req.params;
  const partnerId = req.user?.id;

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
  const partnerId = req.user?.id;
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
  const partnerId = req.user?.id;

  try {
    const schedule = await prisma.pricingSchedule.findFirst({
      where: {
        id: scheduleId,
        listing: { partnerId },
      },
      include: {
        listing: {
          include: {
            schedules: true,
          },
        },
      },
    });

    if (!schedule) {
      return res.status(403).json({ success: false, message: "Schedule not found or you do not have permission to delete it." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.pricingSchedule.delete({
        where: { id: scheduleId },
      });

      // Business Logic: Auto-draft listing if no schedules remain
      const remainingSchedules = schedule.listing.schedules.filter(s => s.id !== scheduleId);
      if (remainingSchedules.length === 0 && schedule.listing.status === 'PUBLISHED') {
        await tx.listing.update({
          where: { id: schedule.listingId },
          data: { status: 'DRAFT' },
        });
      }
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete schedule.", error: error.message });
  }
};

export const getPartnerDashboardStats = async (req, res) => {
  const partnerId = req.user?.id;
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
          status: 'COMPLETED',
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
      totalRevenue: Number(totalRevenueResult._sum.totalPrice) || 0,
      totalListings: Number(totalListings),
      bookings: {
        total: bookingsByStatus.reduce((acc, curr) => acc + Number(curr._count.id), 0),
        confirmed: Number(bookingsByStatus.find(b => b.status === 'CONFIRMED')?._count.id) || 0,
        completed: Number(bookingsByStatus.find(b => b.status === 'COMPLETED')?._count.id) || 0,
        cancelled: Number(bookingsByStatus.find(b => b.status === 'CANCELLED')?._count.id) || 0,
      },
      reviews: {
        total: Number(totalReviews),
        awaitingReply: Number(reviewsAwaitingReply)
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
  const partnerId = "partner_1";

  try {
    const { booking, userEmail, userFullName, userId } = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { listing: true, schedule: true, user: { select: { email: true, fullName: true, id: true } } },
      });

      if (!booking) {
        return res.status(400).json({ success: false, message: "Booking not found." });
      }
      if (booking.listing.partnerId !== partnerId) {
        return res.status(400).json({ success: false, message: "You do not have permission to cancel this booking." });
      }
      if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
        return res.status(400).json({ success: false, message: `Booking cannot be cancelled as it is already ${booking.status}.` });
      }

      await tx.pricingSchedule.update({
        where: { id: booking.scheduleId },
        data: { bookedSlots: { decrement: booking.numParticipants } },
      });

      const cancelledBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
        include: {
          listing: true,
          schedule: true,
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.userId,
          type: 'BOOKING_CANCELLED_BY_PARTNER',
          title: `Booking Cancelled: ${booking.listing.title}`,
          message: `Your booking for ${booking.listing.title} on ${new Date(booking.schedule.startTime).toLocaleString()} was cancelled by the host.`,
          relatedBookingId: booking.id,
          relatedListingId: booking.listingId,
        },
      });

      return { booking: cancelledBooking, userEmail: booking.user.email, userFullName: booking.user.fullName, userId: booking.user.id };
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
    console.log(error)
    res.status(400).json({ success: false, message: error.message });
  }
};

export const approveReservationByPartner = async (req, res) => {
  const { id: bookingId } = req.params;
  const partnerId = "partner_1";

  try {
    const { booking, user } = await prisma.$transaction(async (tx) => {
      const bookingToApprove = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          listing: true,
          user: true,
          schedule: true,
        },
      });

      if (!bookingToApprove) {
        return res.status(400).json({ success: false, message: "Booking not found." });
      }
      if (bookingToApprove.listing.partnerId !== partnerId) {
        return res.status(400).json({ success: false, message: "You do not have permission to approve this booking." });
      }
      if (bookingToApprove.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: `Only pending bookings can be approved. This booking is currently '${bookingToApprove.status}'.` });
      }

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'AWAITING_PAYMENT' },
        include: {
          listing: true, 
        },
      });

      // Create a mock payment record for demo purposes
      await tx.payment.create({
        data: {
          bookingId: updatedBooking.id,
          userId: bookingToApprove.userId,
          amount: bookingToApprove.totalPrice,
          currency: 'MAD',
          status: 'PENDING',
          paymentGateway: 'INTERNAL',
          gatewayTransactionId: `mock_${updatedBooking.id}_${Date.now()}`,
        }
      });

      await tx.notification.create({
        data: {
          userId: bookingToApprove.userId,
          type: 'BOOKING_APPROVED_FOR_PAYMENT',
          title: `Action Required: Your booking for ${bookingToApprove.listing.title} is approved!`,
          message: `Your booking is approved and is now awaiting payment. Please complete the payment to confirm your spot.`,
          relatedBookingId: bookingToApprove.id,
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
        type: 'BOOKING_APPROVED_FOR_PAYMENT',
        title: `Your booking for ${booking.listing.title} is approved!`,
        message: 'Please complete the payment to confirm your spot.',
        bookingId: booking.id,
        paymentLink: paymentLink
      });
    }

    res.status(200).json({ success: true, message: "Booking approved and user has been notified to complete payment." });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPromotion = async (req, res) => {
  const partnerId = req.user?.id;
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
  const partnerId = req.user?.id;

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

export const getPromotionById = async (req, res) => {
  const { promotionId } = req.params;
  const partnerId = req.user?.id;

  try {
    const promotion = await prisma.promotion.findFirst({
      where: { id: promotionId, partnerId },
      include: { listings: { select: { listingId: true } } }
    });

    if (!promotion) {
      return res.status(404).json({ success: false, message: "Promotion not found or you do not have permission to view it." });
    }

    res.status(200).json({ success: true, data: promotion });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch promotion.", error: error.message });
  }
};

export const updatePromotion = async (req, res) => {
  const { promotionId } = req.params;
  const partnerId = req.user?.id;
  const updateData = req.body;

  try {
    const promotion = await prisma.promotion.findFirst({
      where: { id: promotionId, partnerId },
    });

    if (!promotion) {
      return res.status(403).json({ success: false, message: "Promotion not found or you do not have permission to update it." });
    }

    const updatedPromotion = await prisma.promotion.update({
      where: { id: promotionId },
      data: updateData,
    });

    res.status(200).json({ success: true, data: updatedPromotion });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update promotion.", error: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  const { promotionId } = req.params;
  const partnerId = req.user?.id;

  try {
    await prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.findFirst({
        where: { id: promotionId, partnerId }
      });

      if (!promotion) {
        return res.status(400).json({success: false, message: "Promotion not found or you do not have permission to delete it."});
      }

      await tx.listingPromotion.deleteMany({
        where: { promotionId: promotionId },
      });

      await tx.promotion.delete({
        where: { id: promotionId },
      });
    });

    res.status(204).send();
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Failed to delete promotion.", error: error.message });
  }
};

export const removePromotionFromListing = async (req, res) => {
  const { promotionId, listingId } = req.params;
  const partnerId = req.user?.id;

  try {
    // Verify the partner owns the listing before proceeding.
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, partnerId }
    });

    if (!listing) {
      return res.status(403).json({ success: false, message: "Listing not found or you do not have permission to modify it." });
    }

    await prisma.listingPromotion.delete({
      where: {
        listingId_promotionId: {
          listingId: listingId,
          promotionId: promotionId,
        },
      },
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'This promotion was not applied to the specified listing.' });
    }
    res.status(500).json({ success: false, message: "Failed to remove promotion from listing.", error: error.message });
  }
};

export const applyPromotionToListings = async (req, res) => {
  const { promotionId } = req.params;
  const { listingIds } = req.body;
  const partnerId = req.user?.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify the promotion exists and belongs to the partner.
      const promotion = await tx.promotion.findFirst({
        where: { id: promotionId, partnerId },
      });

      if (!promotion) {
        return res.status(400).json({ success: false, message: "Promotion not found or you do not have permission to use it." });
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
        return res.status(400).json({ success: false, message: "One or more listings were not found or do not belong to you." });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBulkSchedules = async (req, res) => {
  const { listingId } = req.params;
  const partnerId = req.user?.id;
  const { schedules, publishListing } = req.body;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, partnerId },
    });

    if (!listing) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing or it does not exist." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdSchedules = await tx.pricingSchedule.createMany({
        data: schedules.map(schedule => ({
          listingId,
          ...schedule,
        })),
      });

      let updatedListing = listing;
      if (publishListing && listing.status === 'DRAFT') {
        updatedListing = await tx.listing.update({
          where: { id: listingId },
          data: { status: 'PUBLISHED' },
        });
      }

      return { createdSchedules, updatedListing };
    });

    res.status(201).json({
      success: true,
      data: result.createdSchedules,
      message: publishListing && listing.status === 'DRAFT'
        ? `${schedules.length} schedules created and listing published!`
        : `${schedules.length} schedules created successfully!`
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'One or more schedules conflict with existing ones.' });
    }
    res.status(500).json({ success: false, message: "Failed to create schedules.", error: error.message });
  }
};

export const getListingPerformanceStats = async (req, res) => {
  const { listingId } = req.params;
  const { startDate, endDate } = req.query;
  const partnerId = req.user?.id;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, partnerId },
      select: { id: true }
    });

    if (!listing) {
      return res.status(403).json({ success: false, message: "Listing not found or you do not have permission to view its stats." });
    }

    const statsFromDb = await prisma.listingDailyStats.findMany({
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

    const stats = statsFromDb.map(stat => ({
      ...stat,
      id: Number(stat.id),
      viewCount: Number(stat.viewCount),
      bookingCount: Number(stat.bookingCount),
    }));

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: "Failed to fetch listing performance stats.", error: error.message });
  }
};