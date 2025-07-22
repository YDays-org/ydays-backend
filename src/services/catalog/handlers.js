import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";

// PUBLIC HANDLERS
export const getListings = async (req, res) => {
  const {
    q, category, type, lat, lon, radius = 10000,
    priceMin, priceMax, dateStart, dateEnd, amenities,
    page = 1, limit = 10
  } = req.query;

  // Convert page and limit to integers
  const pageInt = parseInt(page, 10) || 1;
  const limitInt = parseInt(limit, 10) || 10;
  const offset = (pageInt - 1) * limitInt;
  const amenityIds = amenities ? amenities.split(',').map(id => parseInt(id.trim(), 10)).filter(Number.isInteger) : [];

  // Separate where conditions for different parts of the query
  const listingWhereConditions = [Prisma.sql`l.status = 'published'`];
  const scheduleWhereConditions = []; // For the subquery on pricing_schedules
  const havingConditions = [];
  let joinClauses = [];

  if (q) {
    listingWhereConditions.push(Prisma.sql`(l.title ILIKE ${'%' + q + '%'} OR l.description ILIKE ${'%' + q + '%'})`);
  }
  if (category) {
    // Support filtering by category ID, slug, or name
    const categoryValue = category.trim();
    if (!isNaN(categoryValue)) {
      // If it's a number, treat as ID
      listingWhereConditions.push(Prisma.sql`c.id = ${parseInt(categoryValue)}`);
    } else {
      // If it's a string, try both slug and name
      listingWhereConditions.push(Prisma.sql`(c.slug = ${categoryValue} OR c.name ILIKE ${'%' + categoryValue + '%'})`);
    }
  }
  if (type) {
    // Filter by listing type (activity, event, restaurant)
    const typeValue = type.trim().toLowerCase();
    listingWhereConditions.push(Prisma.sql`l.type = ${typeValue}::\"ListingType\"`);
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
        lp.final_price as cheapest_price,
        lp.capacity as capacity,
        l.average_rating,
        l.review_count
    FROM listings l
    JOIN (
        SELECT DISTINCT ON (ps.listing_id)
            ps.listing_id,
            CASE
                WHEN promo.type = 'PERCENTAGE_DISCOUNT' THEN ps.price * (1 - promo.value / 100)
                WHEN promo.type = 'FIXED_AMOUNT_DISCOUNT' THEN ps.price - promo.value
                ELSE ps.price
            END AS final_price,
            ps.capacity
        FROM pricing_schedules ps
        LEFT JOIN listing_promotions lp_join ON ps.listing_id = lp_join.listing_id
        LEFT JOIN promotions promo ON lp_join.promotion_id = promo.id
            AND promo.is_active = TRUE
            AND NOW() BETWEEN promo.start_date AND promo.end_date
        ${scheduleWhereClause}
        ORDER BY ps.listing_id, final_price ASC
    ) as lp ON l.id = lp.listing_id
    ${finalJoins}
    JOIN categories c ON l.category_id = c.id
    WHERE ${listingWhereClause}
    GROUP BY l.id, lp.final_price, lp.capacity, l.average_rating, l.review_count
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
      filtered.capacity,
      (
        SELECT jsonb_build_object('mediaUrl', lm.media_url, 'isCover', lm.is_cover)
        FROM listing_media lm
        WHERE lm.listing_id = l.id AND lm.is_cover = true
        LIMIT 1
      ) as cover_image
    FROM listings l
    JOIN (${subquery}) as filtered ON l.id = filtered.id
    ORDER BY filtered.average_rating DESC, filtered.review_count DESC
    LIMIT ${limitInt}
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
        page: pageInt,
        limit: limitInt,
        totalPages: Math.ceil(Number(total) / limitInt),
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
            user: {
              select: {
                email: true,
                phoneNumber: true,
              }
            }
          },
        },
        schedules: {
          where: {
            isAvailable: true,
            endTime: {
              gte: new Date()
            }
          },
          orderBy: {
            startTime: 'asc'
          },
          take: 10
        },
        reviews: {
          include: {
            user: {
              select: {
                fullName: true,
                profilePictureUrl: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        }
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

  // Convert page and limit to integers
  const pageInt = parseInt(page, 10) || 1;
  const limitInt = parseInt(limit, 10) || 10;

  try {
    const listings = await prisma.listing.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: limitInt,
      skip: (pageInt - 1) * limitInt,
      include: {
        media: { where: { isCover: true }, take: 1 },
      },
    });

    const total = await prisma.listing.count({ where: { status: 'published' } });

    res.status(200).json({
      success: true,
      data: listings,
      pagination: {
        total,
        page: pageInt,
        limit: limitInt,
        totalPages: Math.ceil(total / limitInt),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch new listings.", error: error.message });
  }
};

export const getTrendingListings = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Convert page and limit to integers
  const pageInt = parseInt(page, 10) || 1;
  const limitInt = parseInt(limit, 10) || 10;
  const offset = (pageInt - 1) * limitInt;

  // This raw query calculates a trend score and fetches the listings.
  // Score = (total views * 1) + (total bookings * 3) in the last 7 days.
  const query = Prisma.sql`
    SELECT
      l.*,
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
    WHERE l.status = 'published'
    ORDER BY s.trend_score DESC, l.average_rating DESC
    LIMIT ${limitInt}
    OFFSET ${offset};
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

    const total = totalResult[0] ? Number(totalResult[0].count) : 0;

    res.status(200).json({
      success: true,
      data: listings,
      pagination: {
        total,
        page: pageInt,
        limit: limitInt,
        totalPages: Math.ceil(total / limitInt),
      },
    });
  } catch (error) {
    console.error("Failed to fetch trending listings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch trending listings.", error: error.message });
  }
};

// PARTNER-PROTECTED HANDLERS
export const createListing = async (req, res) => {
  console.log("🚀 CREATE LISTING - START", { 
    userId: req.user?.id, 
    partnerId: req.user?.partner?.id,
    requestBodyKeys: Object.keys(req.body)
  });

  const { amenityIds, location, ...listingData } = req.body;
  const partnerId = req.user.partner?.id;

  console.log("📝 CREATE LISTING - Parsed data", { 
    partnerId, 
    hasLocation: !!location,
    locationData: location,
    amenityCount: amenityIds?.length || 0,
    listingDataKeys: Object.keys(listingData)
  });

  if (!partnerId) {
    console.log("❌ CREATE LISTING - EARLY EXIT: User is not a partner", { userId: req.user?.id, partnerId });
    return res.status(403).json({ success: false, message: "User is not a partner." });
  }

  try {
    console.log("🔄 CREATE LISTING - Starting transaction...");
    
    // Validate location data upfront since it's required
    if (!location?.lat || !location?.lon) {
      console.log("❌ CREATE LISTING - Missing location data", { location });
      return res.status(400).json({ 
        success: false, 
        message: "Location coordinates (lat, lon) are required for creating a listing" 
      });
    }
    
    const newListing = await prisma.$transaction(async (tx) => {
      console.log("💾 CREATE LISTING - Creating listing in DB with raw SQL", { 
        listingData: {
          ...listingData,
          partnerId: partnerId,
          location: { lat: location.lat, lon: location.lon }
        }
      });

      // Use raw SQL to create the listing because Prisma doesn't support PostGIS geography
      const listingResult = await tx.$queryRaw`
        INSERT INTO listings (
          id, partner_id, category_id, type, title, description, address, 
          location, phone_number, website_url, opening_hours, working_days, 
          metadata, cancellation_policy, accessibility_info, status, 
          created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text,
          ${partnerId}::text,
          ${listingData.categoryId || null}::integer,
          ${listingData.type}::"ListingType",
          ${listingData.title}::text,
          ${listingData.description || null}::text,
          ${listingData.address}::text,
          ST_MakePoint(${location.lon}, ${location.lat})::geography,
          ${listingData.phoneNumber || null}::text,
          ${listingData.website || null}::text,
          ${listingData.openingHours ? JSON.stringify(listingData.openingHours) : null}::jsonb,
          ${listingData.workingDays || []}::text[],
          ${listingData.metadata ? JSON.stringify(listingData.metadata) : null}::jsonb,
          ${listingData.cancellationPolicy || null}::text,
          ${listingData.accessibilityInfo || null}::text,
          ${listingData.status || 'draft'}::"ListingStatus",
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      const createdListingId = listingResult[0]?.id;
      if (!createdListingId) {
        throw new Error("Failed to create listing - no ID returned");
      }

      console.log("✅ CREATE LISTING - Listing created", { listingId: createdListingId });

      // Now handle amenities if provided
      if (amenityIds && amenityIds.length > 0) {
        console.log("🔗 CREATE LISTING - Creating amenity relations", { amenityIds });
        
        for (const amenityId of amenityIds) {
          await tx.listingAmenity.create({
            data: {
              listingId: createdListingId,
              amenityId: amenityId
            }
          });
        }
        
        console.log("✅ CREATE LISTING - Amenities linked");
      }

      return { id: createdListingId };
    });

    console.log("🔍 CREATE LISTING - Fetching final listing with relations", { listingId: newListing.id });

    const finalListing = await prisma.listing.findUnique({
      where: { id: newListing.id },
      include: { 
        amenities: { include: { amenity: true } }, 
        category: true 
      },
    });

    if (!finalListing) {
      throw new Error("Failed to fetch created listing");
    }

    console.log("🎉 CREATE LISTING - SUCCESS", { 
      listingId: finalListing.id,
      title: finalListing.title,
      categoryId: finalListing.categoryId,
      amenityCount: finalListing.amenities?.length || 0
    });

    res.status(201).json({ success: true, data: finalListing });
  } catch (error) {
    console.error("💥 CREATE LISTING - ERROR", { 
      error: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    
    res.status(500).json({ success: false, message: "Failed to create listing.", error: error.message });
  }
};

export const updateListing = async (req, res) => {
  const { id } = req.params;
  const { amenityIds, location, ...updateData } = req.body;
  const partnerId = req.user?.id;

  try {
    const existingListing = await prisma.listing.findUnique({ where: { id } });
    if (!existingListing || existingListing.partnerId !== partnerId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this listing." });
    }

    const updatedListing = await prisma.$transaction(async (tx) => {
      // If metadata is being updated, merge it with existing metadata.
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
  const partnerId = req.user?.id;

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

export const getFavorites = async (req, res) => {
  const { id: userId } = req.user;
  const { page = 1, limit = 20, type } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {
      userId,
      ...(type && {
        listing: {
          type: type.toUpperCase()
        }
      })
    };

    const favorites = await prisma.favorite.findMany({
      where,
      include: {
        listing: {
          include: {
            category: true,
            partner: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true
                  }
                }
              }
            },
            media: {
              where: { isCover: true },
              take: 1
            },
            _count: {
              select: {
                reviews: true,
                bookings: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.favorite.count({ where });

    res.status(200).json({
      success: true,
      data: favorites,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch favorites",
      error: error.message
    });
  }
};

export const checkFavorite = async (req, res) => {
  const { listingId } = req.params;
  const { id: userId } = req.user;

  try {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_listingId: {
          userId,
          listingId
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        isFavorite: !!favorite,
        addedAt: favorite?.createdAt || null
      }
    });

  } catch (error) {
    console.error("Check favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check favorite status",
      error: error.message
    });
  }
};

export const getPersonalizedFeed = async (req, res) => {
  const { id: userId } = req.user;
  const { page = 1, limit = 20 } = req.query;

  // Convert page and limit to integers
  const pageInt = parseInt(page, 10) || 1;
  const limitInt = parseInt(limit, 10) || 20;

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
    where.status = 'published';

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
      skip: (pageInt - 1) * limitInt,
      take: limitInt,
    });

    const total = await prisma.listing.count({ where });

    res.status(200).json({
      success: true,
      data: recommendedListings,
      pagination: {
        total,
        page: pageInt,
        limit: limitInt,
        totalPages: Math.ceil(total / limitInt),
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch personalized feed.", error: error.message });
  }
};

