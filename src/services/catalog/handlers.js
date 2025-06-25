import prisma from "../../lib/prisma.js";

// PUBLIC HANDLERS
export const getListings = async (req, res) => {
  const { q, category, lat, lon, page, limit } = req.query;

  const where = {
    status: "published",
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (category) {
    where.category = { slug: category };
  }

  // Note: Geolocation search requires a raw query because of the PostGIS extension.
  // This is a simplified filter. A real-world app might use a more complex radius search.
  if (lat && lon) {
    // This is a placeholder for actual geo-query logic.
    // Prisma does not yet have a high-level API for PostGIS functions like ST_DWithin.
    // You would typically use prisma.$queryRaw for this.
    console.warn("Geolocation filtering is not fully implemented in this example.");
  }

  try {
    const listings = await prisma.listing.findMany({
      where,
      include: {
        category: true,
        partner: {
          select: { companyName: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = await prisma.listing.count({ where });

    res.status(200).json({
      success: true,
      data: listings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch listings.", error: error.message });
  }
};

export const getListingById = async (req, res) => {
  const { id } = req.params;
  try {
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        category: true,
        amenities: { include: { amenity: true } },
        media: true,
        partner: {
          select: {
            companyName: true,
            companyAddress: true,
            websiteUrl: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found." });
    }
    res.status(200).json({ success: true, data: listing });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch listing.", error: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch categories.", error: error.message });
  }
};

export const getAmenities = async (req, res) => {
  try {
    const amenities = await prisma.amenity.findMany();
    res.status(200).json({ success: true, data: amenities });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch amenities.", error: error.message });
  }
};

// PARTNER-PROTECTED HANDLERS
export const createListing = async (req, res) => {
  const { amenityIds, ...listingData } = req.body;
  const partnerId = req.user.partner?.id;

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  try {
    const listing = await prisma.listing.create({
      data: {
        ...listingData,
        partner: { connect: { id: partnerId } },
        // Connect amenities if provided
        amenities: amenityIds
          ? {
            create: amenityIds.map((id) => ({
              amenity: { connect: { id } },
            })),
          }
          : undefined,
      },
    });
    res.status(201).json({ success: true, data: listing });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create listing.", error: error.message });
  }
};

export const updateListing = async (req, res) => {
  const { id } = req.params;
  const { amenityIds, ...updateData } = req.body;
  const partnerId = req.user.partner?.id;

  try {
    const existingListing = await prisma.listing.findUnique({ where: { id } });
    if (!existingListing || existingListing.partnerId !== partnerId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing." });
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: {
        ...updateData,
        amenities: amenityIds
          ? {
            // This replaces existing amenities. For add/remove, logic would be more complex.
            deleteMany: {},
            create: amenityIds.map((id) => ({
              amenity: { connect: { id } },
            })),
          }
          : undefined,
      },
    });

    res.status(200).json({ success: true, data: listing });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update listing.", error: error.message });
  }
};

export const deleteListing = async (req, res) => {
  const { id } = req.params;
  const partnerId = req.user.partner?.id;

  try {
    const existingListing = await prisma.listing.findUnique({ where: { id } });
    if (!existingListing || existingListing.partnerId !== partnerId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing." });
    }

    await prisma.listing.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete listing.", error: error.message });
  }
};

// USER-PROTECTED HANDLERS
export const addFavorite = async (req, res) => {
  const { listingId } = req.params;
  const { id: userId } = req.user;

  try {
    await prisma.favorite.create({
      data: {
        userId,
        listingId,
      },
    });
    res.status(201).json({ success: true, message: "Listing added to favorites." });
  } catch (error) {
    // Handle case where it's already a favorite
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, message: "Listing is already a favorite." });
    }
    res.status(500).json({ success: false, message: "Failed to add favorite.", error: error.message });
  }
};

export const removeFavorite = async (req, res) => {
  const { listingId } = req.params;
  const { id: userId } = req.user;

  try {
    await prisma.favorite.delete({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });
    res.status(204).send();
  } catch (error) {
    // Handle case where the favorite doesn't exist
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Favorite not found." });
    }
    res.status(500).json({ success: false, message: "Failed to remove favorite.", error: error.message });
  }
};
