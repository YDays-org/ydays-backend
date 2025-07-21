-- Generated based on the provided Prisma Schema
-- Note: Assumes the PostGIS extension is enabled for the geography type.
-- FIX: Added "created_at" and "updated_at" to all tables with the @updatedAt directive.

-- 1. CATEGORIES
-- These are the main types of listings available in the app.
INSERT INTO "categories" (id, name, slug) VALUES
(1, 'Restaurant', 'restaurant'),
(2, 'Cultural', 'cultural'),
(3, 'Activity', 'activity'),
(4, 'Event', 'event'),
(5, 'Workshop', 'workshop');

-- 2. AMENITIES
-- These are features that can be associated with listings.
INSERT INTO "amenities" (id, name, "icon_url") VALUES
(1, 'Wi-Fi', 'https://example.com/icons/wifi.png'),
(2, 'Parking', 'https://example.com/icons/parking.png'),
(3, 'Air Conditioning', 'https://example.com/icons/ac.png'),
(4, 'Wheelchair Accessible', 'https://example.com/icons/accessible.png'),
(5, 'Outdoor Seating', 'https://example.com/icons/seating.png'),
(6, 'Accepts Credit Cards', 'https://example.com/icons/creditcard.png');

-- 3. USERS
-- Creating a mix of customers, partners, and an admin.
INSERT INTO "users" (id, email, "email_verified", "full_name", role, "profile_picture_url", "phone_number", "created_at", "updated_at") VALUES
('cust_firebase_123', 'john.doe@email.com', true, 'John Doe', 'customer', 'https://i.pravatar.cc/150?u=cust_firebase_123', '+212612345678', NOW(), NOW()),
('cust_firebase_456', 'amina.alami@email.com', true, 'Amina Alami', 'customer', 'https://i.pravatar.cc/150?u=cust_firebase_456', '+212666778899', NOW(), NOW()),
('part_firebase_789', 'owner.sqala@email.com', true, 'Karim Bennani', 'partner', 'https://i.pravatar.cc/150?u=part_firebase_789', '+212655112233', NOW(), NOW()),
('part_firebase_abc', 'manager.tourisme@email.com', true, 'Fatima Zahra', 'partner', 'https://i.pravatar.cc/150?u=part_firebase_abc', '+212644556677', NOW(), NOW()),
('admin_firebase_xyz', 'admin@ydaycasablanca.app', true, 'Admin User', 'admin', 'https://i.pravatar.cc/150?u=admin_firebase_xyz', '+212600000000', NOW(), NOW());

-- 4. PARTNERS
-- Linking partner users to their business entities.
INSERT INTO "partners" ("id", "user_id", "company_name", "company_address", "website_url", "social_media_links", "created_at", "updated_at") VALUES
(uuid_generate_v4(), 'part_firebase_789', 'La Sqala Restaurant Group', 'Boulevard des Almohades, Casablanca', 'https://www.sqala.ma', '{"instagram": "lasqalaofficiel", "facebook": "LaSqala"}', NOW(), NOW()),
(uuid_generate_v4(), 'part_firebase_abc', 'Casablanca Tourism & Events', '123 Avenue Mohammed V, Casablanca', 'https://www.casatourisme.ma', '{"twitter": "casatourisme", "facebook": "CasaTourisme"}', NOW(), NOW());

-- 5. LISTINGS
-- The core of the app. Assumes PostGIS is enabled. Format: ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
INSERT INTO "listings" (id, "partner_id", "category_id", type, title, description, address, location, "phone_number", "website_url", "opening_hours", "working_days", status, "cancellation_policy", "accessibility_info", "created_at", "updated_at") VALUES
(uuid_generate_v4(), (SELECT id FROM partners WHERE user_id = 'part_firebase_789'), 1, 'restaurant', 'La Sqala', 'Historic fortress restaurant offering traditional Moroccan cuisine with a beautiful Andalusian garden.', 'Boulevard des Almohades, Casablanca 20250', ST_SetSRID(ST_MakePoint(-7.6222, 33.6063), 4326), '+212522260960', 'https://www.sqala.ma', '{"from": "12:00", "to": "23:00"}', '{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}', 'published', 'Full refund for cancellations made 24 hours in advance.', 'Partially accessible, some steps present.', NOW(), NOW()),
(uuid_generate_v4(), (SELECT id FROM partners WHERE user_id = 'part_firebase_abc'), 3, 'activity', 'Hassan II Mosque Guided Tour', 'Explore one of the largest and most beautiful mosques in the world. Guided tours are available in multiple languages.', 'Boulevard de la Corniche, Casablanca 20000', ST_SetSRID(ST_MakePoint(-7.6328, 33.6083), 4326), '+212522222563', 'https://www.fmh2.ma/fr/', '{"from": "09:00", "to": "16:00"}', '{"Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"}', 'published', 'Non-refundable.', 'Wheelchair accessible with ramps and elevators.', NOW(), NOW()),
(uuid_generate_v4(), (SELECT id FROM partners WHERE user_id = 'part_firebase_abc'), 2, 'event', 'Villa des Arts de Casablanca', 'A beautiful Art Deco villa hosting contemporary art exhibitions from Moroccan and international artists.', '30 Boulevard Brahim Roudani, Casablanca 20000', ST_SetSRID(ST_MakePoint(-7.6293, 33.5873), 4326), '+212522295087', 'https://www.fondationona.ma', '{"from": "09:30", "to": "19:00"}', '{"Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}', 'published', 'Free entry, no cancellation needed.', 'Fully accessible.', NOW(), NOW()),
(uuid_generate_v4(), (SELECT id FROM partners WHERE user_id = 'part_firebase_789'), 1, 'restaurant', 'Rick''s Café', 'A recreation of the mythical saloon from the film "Casablanca," featuring classic design, an international menu, and live jazz.', '248 Boulevard Sour Jdid, Place du jardin public, Casablanca 20250', ST_SetSRID(ST_MakePoint(-7.6247, 33.6053), 4326), '+212522274207', 'http://www.rickscafe.ma/', '{"from": "18:30", "to": "01:00"}', '{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}', 'published', 'Cancellation required 6 hours in advance for a refund.', 'Not specified.', NOW(), NOW());

-- 6. LISTING MEDIA
-- Images and videos for the listings.
INSERT INTO "listing_media" (id, "listing_id", "media_url", "media_type", "is_cover") VALUES
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'La Sqala'), 'https://i.imgur.com/gQf4G3s.jpg', 'image', true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'La Sqala'), 'https://i.imgur.com/rL4J2yW.jpg', 'image', false),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), 'https://i.imgur.com/5J3J3U2.jpg', 'image', true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), 'https://i.imgur.com/sM8Q2zH.jpg', 'image', true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Rick''s Café'), 'https://i.imgur.com/kS9j8A3.jpg', 'image', true);


-- 7. LISTING AMENITIES (Many-to-Many)
-- Connecting listings with their available amenities.
INSERT INTO "listing_amenities" ("listing_id", "amenity_id") VALUES
((SELECT id FROM listings WHERE title = 'La Sqala'), 1), ((SELECT id FROM listings WHERE title = 'La Sqala'), 5), ((SELECT id FROM listings WHERE title = 'La Sqala'), 6),
((SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), 2), ((SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), 4), ((SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), 6),
((SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), 1), ((SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), 4),
((SELECT id FROM listings WHERE title = 'Rick''s Café'), 1), ((SELECT id FROM listings WHERE title = 'Rick''s Café'), 3), ((SELECT id FROM listings WHERE title = 'Rick''s Café'), 6);

-- 8. PRICING SCHEDULES
INSERT INTO "pricing_schedules" (id, "listing_id", "start_time", "end_time", price, currency, capacity, "is_available") VALUES
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'La Sqala'), '2025-07-15T20:00:00Z', '2025-07-15T22:00:00Z', 350.00, 'MAD', 20, true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), '2025-07-16T10:00:00Z', '2025-07-16T11:00:00Z', 130.00, 'MAD', 15, true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), '2025-07-16T14:00:00Z', '2025-07-16T15:00:00Z', 130.00, 'MAD', 15, true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Rick''s Café'), '2025-07-18T21:00:00Z', '2025-07-18T23:00:00Z', 500.00, 'MAD', 10, true),
-- Villa des Arts: Multiple daily free entry slots
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), '2025-07-17T09:30:00Z', '2025-07-17T12:00:00Z', 0.00, 'MAD', 25, true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), '2025-07-17T14:00:00Z', '2025-07-17T18:30:00Z', 0.00, 'MAD', 25, true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), '2025-07-18T09:30:00Z', '2025-07-18T12:00:00Z', 0.00, 'MAD', 25, true),
(uuid_generate_v4(), (SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), '2025-07-18T14:00:00Z', '2025-07-18T18:30:00Z', 0.00, 'MAD', 25, true);

-- 9. BOOKINGS
-- User bookings for specific listing schedules.
INSERT INTO "bookings" (id, "user_id", "listing_id", "schedule_id", "num_participants", "total_price", status, "created_at", "updated_at") VALUES
(uuid_generate_v4(), 'cust_firebase_123', (SELECT id FROM listings WHERE title = 'La Sqala'), (SELECT id FROM pricing_schedules WHERE listing_id = (SELECT id FROM listings WHERE title = 'La Sqala') AND start_time = '2025-07-15T20:00:00Z'), 2, 700.00, 'confirmed', NOW(), NOW()),
(uuid_generate_v4(), 'cust_firebase_456', (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), (SELECT id FROM pricing_schedules WHERE listing_id = (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour') AND start_time = '2025-07-16T10:00:00Z'), 1, 130.00, 'confirmed', NOW(), NOW()),
(uuid_generate_v4(), 'cust_firebase_123', (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), (SELECT id FROM pricing_schedules WHERE listing_id = (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour') AND start_time = '2025-07-16T14:00:00Z'), 4, 520.00, 'pending', NOW(), NOW()),
(uuid_generate_v4(), 'cust_firebase_456', (SELECT id FROM listings WHERE title = 'Rick''s Café'), (SELECT id FROM pricing_schedules WHERE listing_id = (SELECT id FROM listings WHERE title = 'Rick''s Café') AND start_time = '2025-07-18T21:00:00Z'), 2, 1000.00, 'awaiting_payment', NOW(), NOW());

-- Let's update the booked_slots count in the schedules table
UPDATE "pricing_schedules" SET "booked_slots" = 2 WHERE listing_id = (SELECT id FROM listings WHERE title = 'La Sqala') AND start_time = '2025-07-15T20:00:00Z';
UPDATE "pricing_schedules" SET "booked_slots" = 1 WHERE listing_id = (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour') AND start_time = '2025-07-16T10:00:00Z';
UPDATE "pricing_schedules" SET "booked_slots" = 4 WHERE listing_id = (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour') AND start_time = '2025-07-16T14:00:00Z';
UPDATE "pricing_schedules" SET "booked_slots" = 2 WHERE listing_id = (SELECT id FROM listings WHERE title = 'Rick''s Café') AND start_time = '2025-07-18T21:00:00Z';

-- 10. PAYMENTS
-- Payment records for bookings.
INSERT INTO "payments" (id, "booking_id", "user_id", amount, currency, status, "payment_gateway", "gateway_transaction_id", "created_at", "updated_at") VALUES
(uuid_generate_v4(), (SELECT id FROM bookings WHERE user_id = 'cust_firebase_123' AND listing_id = (SELECT id FROM listings WHERE title = 'La Sqala')), 'cust_firebase_123', 700.00, 'MAD', 'succeeded', 'Stripe', 'pi_1', NOW(), NOW()),
(uuid_generate_v4(), (SELECT id FROM bookings WHERE user_id = 'cust_firebase_456' AND listing_id = (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour')), 'cust_firebase_456', 130.00, 'MAD', 'succeeded', 'CMI', 'cmi_2', NOW(), NOW());

-- 11. REVIEWS
-- User reviews for their completed bookings.
INSERT INTO "reviews" (id, "user_id", "listing_id", "booking_id", rating, comment, "partner_reply", "created_at", "updated_at") VALUES
(uuid_generate_v4(), 'cust_firebase_123', (SELECT id FROM listings WHERE title = 'La Sqala'), (SELECT id FROM bookings WHERE user_id = 'cust_firebase_123' AND listing_id = (SELECT id FROM listings WHERE title = 'La Sqala')), 5, 'Absolutely magical experience! The food was divine and the garden is an oasis in the city.', 'Thank you for your kind words! We are delighted you enjoyed your evening at La Sqala.', NOW(), NOW()),
(uuid_generate_v4(), 'cust_firebase_456', (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), (SELECT id FROM bookings WHERE user_id = 'cust_firebase_456' AND listing_id = (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour')), 4, 'The mosque is breathtaking. The tour was very informative but felt a little rushed.', NULL, NOW(), NOW());

-- Let's update the listing's average rating and review count
UPDATE "listings" SET "average_rating" = 5.00, "review_count" = 1 WHERE title = 'La Sqala';
UPDATE "listings" SET "average_rating" = 4.00, "review_count" = 1 WHERE title = 'Hassan II Mosque Guided Tour';


-- 12. FAVORITES
-- Users can mark listings as favorites.
INSERT INTO "favorites" ("user_id", "listing_id", "created_at") VALUES
('cust_firebase_123', (SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), NOW()),
('cust_firebase_123', (SELECT id FROM listings WHERE title = 'Rick''s Café'), NOW()),
('cust_firebase_456', (SELECT id FROM listings WHERE title = 'La Sqala'), NOW());

-- 13. NOTIFICATIONS
-- System notifications for users.
INSERT INTO "notifications" (id, "user_id", type, title, message, "is_read", "related_booking_id", "created_at") VALUES
(uuid_generate_v4(), 'part_firebase_789', 'new_booking_request', 'New Reservation', 'You have a new reservation for La Sqala for 2 people.', false, (SELECT id FROM bookings WHERE user_id = 'cust_firebase_123' AND listing_id = (SELECT id FROM listings WHERE title = 'La Sqala')), NOW()),
(uuid_generate_v4(), 'cust_firebase_123', 'booking_confirmed', 'Reservation Confirmed!', 'Your booking at La Sqala for 2 people has been confirmed.', false, (SELECT id FROM bookings WHERE user_id = 'cust_firebase_123' AND listing_id = (SELECT id FROM listings WHERE title = 'La Sqala')), NOW()),
(uuid_generate_v4(), 'cust_firebase_456', 'reservation_reminder', 'Reminder: Hassan II Mosque Tour', 'Your guided tour is tomorrow at 10:00 AM. Don''t forget your ticket!', false, (SELECT id FROM bookings WHERE user_id = 'cust_firebase_456' AND listing_id = (SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour')), NOW());

INSERT INTO "listing_daily_stats" ("listing_id", "stat_date", "view_count", "booking_count") VALUES
-- La Sqala is popular
((SELECT id FROM listings WHERE title = 'La Sqala'), NOW() - INTERVAL '1 day', 150, 5),
((SELECT id FROM listings WHERE title = 'La Sqala'), NOW() - INTERVAL '2 day', 120, 2),
-- Hassan II Mosque gets a lot of views and bookings
((SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), NOW() - INTERVAL '1 day', 250, 10),
((SELECT id FROM listings WHERE title = 'Hassan II Mosque Guided Tour'), NOW() - INTERVAL '3 day', 200, 8),
-- Villa des Arts gets views but no bookings in our mock data
((SELECT id FROM listings WHERE title = 'Villa des Arts de Casablanca'), NOW() - INTERVAL '2 day', 80, 0),
-- Rick's Cafe gets views and one awaiting payment booking
((SELECT id FROM listings WHERE title = 'Rick''s Café'), NOW() - INTERVAL '1 day', 180, 1);