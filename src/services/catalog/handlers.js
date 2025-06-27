import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";

// PUBLIC HANDLERS
export const getListings = async (req, res) => {
  const {
    q, category, lat, lon, radius = 10000,
    priceMin, priceMax, dateStart, dateEnd, amenities,
    page = 1, limit = 10
  } = req.query;

  const offset = (page - 1) * limit;
  const amenityIds = amenities ? amenities.split(',').map(id => parseInt(id.trim(), 10)).filter(Number.isInteger) : [];

  const whereConditions = [Prisma.sql`l.status = 'PUBLISHED'`];
  let joinClauses = [];
  const havingConditions = [];

  if (q) {
    whereConditions.push(Prisma.sql`(l.title ILIKE ${'%' + q + '%'} OR l.description ILIKE ${'%' + q + '%'})`);
  }
  if (category) {
    whereConditions.push(Prisma.sql`c.slug = ${category}`);
  }
  if (lat && lon && radius) {
    whereConditions.push(Prisma.sql`ST_DWithin(l.location, ST_MakePoint(${parseFloat(lon)}, ${parseFloat(lat)})::geography, ${radius})`);
  }
  if (amenityIds.length > 0) {
    joinClauses.push(Prisma.sql`INNER JOIN listing_amenities la ON l.id = la.listing_id`);
    whereConditions.push(Prisma.sql`la.amenity_id = ANY(${amenityIds})`);
  }
  if (priceMin !== undefined) {
    havingConditions.push(Prisma.sql`MIN(final_price) >= ${parseFloat(priceMin)}`);
  }
  if (priceMax !== undefined) {
    havingConditions.push(Prisma.sql`MIN(final_price) <= ${parseFloat(priceMax)}`);
  }
  if (dateStart) {
    whereConditions.push(Prisma.sql`ps.start_time >= ${dateStart}::timestamptz`);
  }
  if (dateEnd) {
    whereConditions.push(Prisma.sql`ps.end_time <= ${dateEnd}::timestamptz`);
  }

  const whereClause = Prisma.join(whereConditions, ' AND ');
  const havingClause = havingConditions.length > 0 ? Prisma.sql`HAVING ${Prisma.join(havingConditions, ' AND ')}` : Prisma.empty;
  const finalJoins = Prisma.join(joinClauses, ' ');

  const baseQuery = Prisma.sql`
    FROM listings l
    JOIN categories c ON l.category_id = c.id
    ${finalJoins}
    WHERE ${whereClause}
    GROUP BY l.id, c.id
  `;

  const subquery = Prisma.sql`
    SELECT l.id, MIN(lp.final_price) as cheapest_price, l.average_rating, l.review_count
    FROM listings l
    JOIN (
      SELECT
        ps.listing_id,
        CASE
          WHEN promo.type = 'PERCENTAGE_DISCOUNT' THEN ps.price * (1 - promo.value / 100)
          WHEN promo.type = 'FIXED_AMOUNT_DISCOUNT' THEN ps.price - promo.value
          ELSE ps.price
        END AS final_price
      FROM pricing_schedules ps
      LEFT JOIN listing_promotions lp ON ps.listing_id = lp.listing_id
      LEFT JOIN promotions promo ON lp.promotion_id = promo.id
        AND promo.is_active = TRUE
        AND NOW() BETWEEN promo.start_date AND promo.end_date
    ) as lp ON l.id = lp.listing_id
    ${finalJoins}
    JOIN categories c ON l.category_id = c.id
    WHERE ${whereClause}
    GROUP BY l.id
    ${havingClause}
  `;

  const countQuery = Prisma.sql`SELECT COUNT(*) FROM (${subquery}) AS sub`;
  const dataQuery = Prisma.sql`
    SELECT l.*, filtered.cheapest_price,
      (SELECT json_agg(json_build_object('url', lm.media_url, 'is_cover', lm.is_cover)) FROM listing_media lm WHERE lm.listing_id = l.id AND lm.is_cover = true LIMIT 1) as cover_image
    FROM listings l
    JOIN (${subquery}) as filtered ON l.id = filtered.id
    ORDER BY filtered.average_rating DESC, filtered.review_count DESC
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  try {
    const [totalResult, listings] = await prisma.$transaction([
      prisma.$queryRaw(countQuery),
      prisma.$queryRaw(dataQuery)
    ]);

    const total = totalResult[0] ? BigInt(totalResult[0].count) : 0n;

    res.status(200).json({
      success: true,
      data: listings,
      pagination: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch listings with raw query:", error);
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

    // Fire-and-forget the stat update. No need to await it.
    prisma.listingDailyStats.upsert({
      where: {
        listingId_statDate: {
          listingId: id,
          statDate: new Date(new Date().setHours(0, 0, 0, 0)),
        }
      },
      create: {
        listingId: id,
        statDate: new Date(new Date().setHours(0, 0, 0, 0)),
        viewCount: 1,
      },
      update: {
        viewCount: { increment: 1 },
      },
    }).catch(console.error);

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
  const { amenityIds, location, ...listingData } = req.body;
  const partnerId = req.user.partner?.id;

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  try {
    const newListing = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: {
          ...listingData,
          partner: { connect: { id: partnerId } },
          amenities: amenityIds
            ? {
              create: amenityIds.map((id) => ({
                amenity: { connect: { id } },
              })),
            }
            : undefined,
        },
      });

      if (location?.lat && location?.lon) {
        await tx.$executeRaw`
          UPDATE listings
          SET location = ST_MakePoint(${location.lon}, ${location.lat})::geography
          WHERE id = ${listing.id}
        `;
      }

      return listing;
    });

    const finalListing = await prisma.listing.findUnique({
      where: { id: newListing.id },
      include: { amenities: { include: { amenity: true } }, category: true },
    });

    res.status(201).json({ success: true, data: finalListing });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create listing.", error: error.message });
  }
};

export const updateListing = async (req, res) => {
  const { id } = req.params;
  const { amenityIds, location, ...updateData } = req.body;
  const partnerId = req.user.partner?.id;

  try {
    const existingListing = await prisma.listing.findUnique({ where: { id } });
    if (!existingListing || existingListing.partnerId !== partnerId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing." });
    }

    const updatedListing = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.update({
        where: { id },
        data: {
          ...updateData,
          amenities: amenityIds
            ? {
              deleteMany: {},
              create: amenityIds.map((id) => ({
                amenity: { connect: { id } },
              })),
            }
            : undefined,
        },
      });

      if (location?.lat && location?.lon) {
        await tx.$executeRaw`
          UPDATE listings
          SET location = ST_MakePoint(${location.lon}, ${location.lat})::geography
          WHERE id = ${id}
        `;
      }

      return listing;
    });

    const finalListing = await prisma.listing.findUnique({
      where: { id: updatedListing.id },
      include: { amenities: { include: { amenity: true } }, category: true },
    });

    res.status(200).json({ success: true, data: finalListing });
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

export const getPersonalizedFeed = async (req, res) => {
  const { id: userId } = req.user;
  const { page, limit } = req.query;

  try {
    // 1. Find all listings the user has booked or favorited to determine their interests.
    const userInteractions = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        bookings: { select: { listing: { select: { categoryId: true, id: true } } } },
        favorites: { select: { listing: { select: { categoryId: true, id: true } } } },
      },
    });

    if (!userInteractions) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // 2. Extract unique category IDs from their interactions.
    const interestedCategoryIds = [...new Set([
      ...userInteractions.bookings.map(b => b.listing.categoryId),
      ...userInteractions.favorites.map(f => f.listing.categoryId),
    ])].filter(id => id !== null);

    // 3. Extract IDs of listings the user has already interacted with to exclude them from recommendations.
    const interactedListingIds = [...new Set([
      ...userInteractions.bookings.map(b => b.listing.id),
      ...userInteractions.favorites.map(f => f.listing.id),
    ])];

    let where = {};
    // If user has shown interest, recommend from those categories.
    if (interestedCategoryIds.length > 0) {
      where = {
        categoryId: { in: interestedCategoryIds },
      };
    }
    // Always exclude listings they've already booked or favorited.
    where.id = { notIn: interactedListingIds };
    where.status = 'PUBLISHED';

    // 4. Find listings to recommend.
    const recommendedListings = await prisma.listing.findMany({
      where,
      include: {
        category: true,
        media: { where: { isCover: true }, take: 1 },
      },
      orderBy: [
        { averageRating: 'desc' },
        { reviewCount: 'desc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await prisma.listing.count({ where });

    res.status(200).json({
      success: true,
      data: recommendedListings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch personalized feed.", error: error.message });
  }
};
