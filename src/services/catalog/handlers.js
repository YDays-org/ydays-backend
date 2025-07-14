import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { randomUUID } from "node:crypto";

// PUBLIC HANDLERS
export const getListings = async (req, res) => {
  const {
    q, category, type, lat, lon, radius = 10000,
    priceMin, priceMax, dateStart, dateEnd, amenities,
    page = 1, limit = 10
  } = req.query;

  const offset = (page - 1) * limit;
  const amenityIds = amenities ? amenities.split(',').map(id => parseInt(id.trim(), 10)).filter(Number.isInteger) : [];

  // Separate where conditions for different parts of the query
  const listingWhereConditions = [Prisma.sql`l.status = 'PUBLISHED'`];
  const scheduleWhereConditions = []; // For the subquery on pricing_schedules
  const havingConditions = [];
  let joinClauses = [];

  if (q) {
    listingWhereConditions.push(Prisma.sql`(l.title ILIKE ${'%' + q + '%'} OR l.description ILIKE ${'%' + q + '%'})`);
  }
  if (category) {
    listingWhereConditions.push(Prisma.sql`c.slug = ${category}`);
  }
  if (type) {
    listingWhereConditions.push(Prisma.sql`l.type = ${type}`);
  }
  if (lat && lon && radius) {
    listingWhereConditions.push(Prisma.sql`ST_DWithin(l.location, ST_MakePoint(${parseFloat(lon)}, ${parseFloat(lat)})::geography, ${radius})`);
  }
  if (amenityIds.length > 0) {
    joinClauses.push(Prisma.sql`INNER JOIN listing_amenities la ON l.id = la.listing_id`);
    listingWhereConditions.push(Prisma.sql`la.amenity_id = ANY(${amenityIds})`);
  }

  // Price filters operate on the final aggregated price, so they use HAVING
  if (priceMin !== undefined) {
    havingConditions.push(Prisma.sql`MIN(final_price) >= ${parseFloat(priceMin)}`);
  }
  if (priceMax !== undefined) {
    havingConditions.push(Prisma.sql`MIN(final_price) <= ${parseFloat(priceMax)}`);
  }

  // Date filters operate on the schedule, so they go into the schedule subquery
  if (dateStart) {
    scheduleWhereConditions.push(Prisma.sql`ps.start_time >= ${dateStart}::timestamptz`);
  }
  if (dateEnd) {
    scheduleWhereConditions.push(Prisma.sql`ps.end_time <= ${dateEnd}::timestamptz`);
  }

  const listingWhereClause = Prisma.join(listingWhereConditions, ' AND ');
  const scheduleWhereClause = scheduleWhereConditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(scheduleWhereConditions, ' AND ')}` : Prisma.empty;
  const havingClause = havingConditions.length > 0 ? Prisma.sql`HAVING ${Prisma.join(havingConditions, ' AND ')}` : Prisma.empty;
  const finalJoins = joinClauses.length > 0 ? Prisma.join(joinClauses, ' ') : Prisma.empty;

  const subquery = Prisma.sql`
    SELECT
        l.id,
        MIN(lp.final_price) as cheapest_price,
        l.average_rating,
        l.review_count
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
        LEFT JOIN listing_promotions lp_join ON ps.listing_id = lp_join.listing_id
        LEFT JOIN promotions promo ON lp_join.promotion_id = promo.id
            AND promo.is_active = TRUE
            AND NOW() BETWEEN promo.start_date AND promo.end_date
        WHERE ps.is_available = TRUE
        ${scheduleWhereConditions.length > 0 ? Prisma.sql`AND ${Prisma.join(scheduleWhereConditions, ' AND ')}` : Prisma.empty}
    ) as lp ON l.id = lp.listing_id
    ${finalJoins}
    JOIN categories c ON l.category_id = c.id
    WHERE ${listingWhereClause}
    GROUP BY l.id
    ${havingClause}
  `;

  const countQuery = Prisma.sql`SELECT COUNT(*) FROM (${subquery}) AS sub`;
  const dataQuery = Prisma.sql`
    SELECT
      l.id,
      l.partner_id,
      l.category_id,
      l.type,
      l.title,
      l.description,
      l.address,
      ST_AsText(l.location) as location_text,
      l.phone_number,
      l.website_url,
      l.opening_hours,
      l.working_days,
      l.metadata,
      l.cancellation_policy,
      l.accessibility_info,
      l.status,
      l.average_rating,
      l.review_count,
      l.created_at,
      l.updated_at,
      filtered.cheapest_price,
      (
        SELECT jsonb_build_object('mediaUrl', lm.media_url, 'isCover', lm.is_cover)
        FROM listing_media lm
        WHERE lm.listing_id = l.id AND lm.is_cover = true
        LIMIT 1
      ) as cover_image
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

export const getNewListings = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  try {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    const listings = await prisma.listing.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: take,
      skip: skip,
      include: {
        media: { where: { isCover: true }, take: 1 },
      },
    });

    const total = await prisma.listing.count({ where: { status: 'PUBLISHED' } });

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
    res.status(500).json({ success: false, message: "Failed to fetch new listings.", error: error.message });
  }
}

export const getTrendingListings = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const take = parseInt(limit, 10);
  const skip = (parseInt(page, 10) - 1) * take;

  const query = Prisma.sql`
    SELECT
      l.id, l.partner_id, l.category_id, l.type, l.title, l.description,
      l.address, ST_AsText(l.location) as location_text, l.phone_number,
      l.website_url, l.opening_hours, l.working_days, l.metadata,
      l.cancellation_policy, l.accessibility_info, l.status, l.average_rating,
      l.review_count, l.created_at, l.updated_at,
      (
        SELECT jsonb_build_object('mediaUrl', lm.media_url, 'isCover', lm.is_cover)
        FROM listing_media lm
        WHERE lm.listing_id = l.id AND lm.is_cover = true
        LIMIT 1
      ) as cover_image,
      s.trend_score
    FROM listings l
    JOIN (
      SELECT
        listing_id,
        SUM(view_count) + (SUM(booking_count) * 3) AS trend_score
      FROM listing_daily_stats
      WHERE stat_date >= ${sevenDaysAgo}
      GROUP BY listing_id
    ) s ON l.id = s.listing_id
    WHERE l.status = 'PUBLISHED'
    ORDER BY s.trend_score DESC, l.average_rating DESC
    LIMIT ${take}
    OFFSET ${skip};
  `;

  const countQuery = Prisma.sql`
    SELECT COUNT(DISTINCT listing_id)
    FROM listing_daily_stats
    WHERE stat_date >= ${sevenDaysAgo};
  `;

  try {
    const [listings, totalResult] = await prisma.$transaction([
      prisma.$queryRaw(query),
      prisma.$queryRaw(countQuery),
    ]);

    // FIX: Manually convert BigInt fields to Numbers before sending the response.
    const listingsWithNumbers = listings.map(listing => ({
      ...listing,
      trend_score: Number(listing.trend_score), // trend_score is a BigInt
      // If other BigInts existed, they would be converted here too.
    }));

    const total = totalResult[0] ? Number(totalResult[0].count) : 0; // This was already correct

    res.status(200).json({
      success: true,
      data: listingsWithNumbers,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Failed to fetch trending listings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trending listings.", error: error.message });
  }
};

// PARTNER-PROTECTED HANDLERS
export const createListing = async (req, res) => {
  const { amenityIds, location, ...requestData } = req.body;
  const partnerId = req.user?.id; // Use the actual partner ID from database

  if (!partnerId) {
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  // According to your validation schema, location is required.
  // This check adds robustness.
  if (!location?.lat || !location?.lon) {
    return res.status(400).json({ success: false, message: "Location with lat and lon is required." });
  }

  // Validate that published listings should have pricing schedules (logic from original code)
  if (requestData.status === 'PUBLISHED') {
    return res.status(400).json({
      success: false,
      message: "Cannot publish listing without pricing schedules. Create as DRAFT and add schedules first."
    });
  }

  const newListingId = randomUUID(); // Generate the ID before the transaction

  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Create the listing with a raw SQL INSERT to handle the PostGIS location
      await tx.$executeRaw`
        INSERT INTO "listings" (
          "id", "partner_id", "category_id", "type", "title", "description",
          "address", "location", "phone_number", "website_url", "opening_hours",
          "working_days", "metadata", "cancellation_policy", "accessibility_info", "status",
          "created_at", "updated_at"
        ) VALUES (
          ${newListingId}, ${partnerId}, ${requestData.categoryId}, ${requestData.type}::"ListingType",
          ${requestData.title}, ${requestData.description}, ${requestData.address},
          ST_SetSRID(ST_MakePoint(${location.lon}, ${location.lat}), 4326),
          ${requestData.phoneNumber || null}, ${requestData.website || null},
          ${JSON.stringify(requestData.openingHours) || null}::jsonb,
          ${requestData.workingDays || []}, ${JSON.stringify(requestData.metadata)}::jsonb,
          ${requestData.cancellationPolicy || null}, ${requestData.accessibilityInfo || null},
          ${requestData.status || 'DRAFT'}::"ListingStatus",
          NOW(), NOW()
        )
      `;

      if (amenityIds && amenityIds.length > 0) {
        await tx.listing.update({
          where: { id: newListingId },
          data: {
            amenities: {
              create: amenityIds.map((amenityId) => ({
                amenity: { connect: { id: amenityId } },
              })),
            },
          }
        });
      }
    });

    const finalListing = await prisma.listing.findUnique({
      where: { id: newListingId },
      include: {
        amenities: { include: { amenity: true } },
        category: true,
        schedules: true,
        media: true,
      },
    });

    res.status(201).json({ success: true, data: finalListing });
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create listing.",
      error: error.message
    });
  }
};

export const updateListing = async (req, res) => {
  const { id } = req.params;
  const { amenityIds, location, ...updateData } = req.body;
  // const partnerId = req.user?.id;
  const partnerId = "partner_1";

  try {
    const existingListing = await prisma.listing.findUnique({ where: { id } });
    if (!existingListing || existingListing.partnerId !== partnerId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing." });
    }

    const updatedListing = await prisma.$transaction(async (tx) => {
      if (updateData.metadata) {
        const existingMetadata = (existingListing.metadata || {});
        updateData.metadata = { ...existingMetadata, ...updateData.metadata };
      }

      const listing = await tx.listing.update({
        where: { id },
        data: {
          ...updateData,
          amenities: amenityIds
            ? {
              deleteMany: {},
              create: amenityIds.map((amenityId) => ({
                amenity: { connect: { id: amenityId } },
              })),
            }
            : undefined,
        },
      });

      if (location?.lat && location?.lon) {
        // FIX: Use ST_SetSRID for explicit and robust location updates
        await tx.$executeRaw`
          UPDATE listings
          SET location = ST_SetSRID(ST_MakePoint(${location.lon}, ${location.lat}), 4326)
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
    console.error("Update listing error:", error); // Add a console log for better debugging
    res.status(500).json({ success: false, message: "Failed to update listing.", error: error.message });
  }
};

export const deleteListing = async (req, res) => {
  const { id } = req.params;
  // const partnerId = req.user?.id;

  try {
    const existingListing = await prisma.listing.findUnique({ where: { id } });
    if (!existingListing || existingListing.partnerId !== "partner_1") {
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
  // const { id: userId } = req.user;
  

  try {
    await prisma.favorite.create({
      data: {
        userId: "cust_firebase_123",
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
  // const { id: userId } = req.user;

  try {
    await prisma.favorite.delete({
      where: {
        userId_listingId: {
          userId: "cust_firebase_123",
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
  const { page = 1, limit = 20 } = req.query;
  const take = parseInt(limit, 10);
  const skip = (parseInt(page, 10) - 1) * take;

  try {
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

    const interestedCategoryIds = [...new Set([
      ...userInteractions.bookings.map(b => b.listing.categoryId),
      ...userInteractions.favorites.map(f => f.listing.categoryId),
    ])].filter(id => id !== null);

    let where = { status: 'PUBLISHED' };
    if (interestedCategoryIds.length > 0) {
      where.categoryId = { in: interestedCategoryIds };
    }

    // Find listings to recommend.
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
      skip: skip,
      take: take,
    });

    const total = await prisma.listing.count({ where });

    res.status(200).json({
      success: true,
      data: recommendedListings,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });

  } catch (error) {
    console.error("Failed to fetch personalized feed:", error);
    res.status(500).json({ success: false, message: "Failed to fetch personalized feed.", error: error.message });
  }
};
