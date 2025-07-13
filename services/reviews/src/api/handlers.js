import { prisma } from "@casablanca/common";

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
  const { listingId } = req.query;
  const { page, limit } = req.query;

  try {
    const reviews = await prisma.review.findMany({
      where: { listingId },
      include: {
        user: {
          select: { fullName: true, profilePictureUrl: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.review.count({ where: { listingId } });

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
    // 1. Find the review and its associated listing
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { listing: true },
    });

    // 2. Verify ownership
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }
    if (review.listing.partnerId !== partnerId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing." });
    }

    // 3. Update the review with the reply
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: { partnerReply: reply },
    });

    res.status(200).json({ success: true, data: updatedReview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to add reply.", error: error.message });
  }
};
