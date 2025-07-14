import prisma from "../../lib/prisma.js";

export const submitReview = async (req, res) => {
  const { bookingId, rating, comment } = req.body;
  const { id: userId } = req.user;

  try {
    const newReview = await prisma.$transaction(async (tx) => {
      // 1. Verify the booking exists, is completed, and belongs to the user.
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new Error("Booking not found.");
      }
      if (booking.userId !== userId) {
        throw new Error("You can only review your own bookings.");
      }
      // Uncomment this line if reviews should only be for 'completed' bookings
      // if (booking.status !== 'COMPLETED') {
      //   throw new Error("You can only review completed bookings.");
      // }

      // 2. Check if a review for this booking already exists.
      const existingReview = await tx.review.findUnique({
        where: { bookingId },
      });
      if (existingReview) {
        throw new Error("A review for this booking has already been submitted.");
      }

      // 3. Create the new review.
      const review = await tx.review.create({
        data: {
          userId,
          listingId: booking.listingId,
          bookingId,
          rating,
          comment,
        },
      });

      // 4. Update the listing's average rating and review count.
      const aggregate = await tx.review.aggregate({
        where: { listingId: booking.listingId },
        _avg: { rating: true },
        _count: { id: true },
      });

      await tx.listing.update({
        where: { id: booking.listingId },
        data: {
          averageRating: aggregate._avg.rating,
          reviewCount: aggregate._count.id,
        },
      });

      return review;
    });

    res.status(201).json({ success: true, data: newReview });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getReviewsForListing = async (req, res) => {
  const { listingId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    const reviews = await prisma.review.findMany({
      where: { listingId },
      include: {
        user: {
          select: { fullName: true, profilePictureUrl: true },
        },
      },
      skip,
      take, 
      orderBy: { createdAt: "desc" },
    });

    const totalFromDb = await prisma.review.count({ where: { listingId } });
    const total = Number(totalFromDb);

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page: parseInt(page, 10), 
        limit: take, 
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reviews.", error: error.message });
  }
};

export const addPartnerReply = async (req, res) => {
  const { id: reviewId } = req.params;
  const { reply } = req.body;
  const partnerId = req.user?.id;

  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { listing: true },
    });

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }
    if (review.listing.partnerId !== partnerId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing." });
    }

    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: { partnerReply: reply },
    });

    res.status(200).json({ success: true, data: updatedReview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to add reply.", error: error.message });
  }
};
