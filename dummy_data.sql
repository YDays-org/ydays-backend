-- Mock Data for YDAYS 2025 Casablanca App
-- Generated based on the provided Prisma Schema
-- Note: Assumes the PostGIS extension is enabled for the geography type.

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
-- The 'id' column corresponds to 'firebase_uid'.
INSERT INTO "users" (id, email, "email_verified", "full_name", role, "profile_picture_url", "phone_number") VALUES
('cust_firebase_123', 'john.doe@email.com', true, 'John Doe', 'CUSTOMER', 'https://i.pravatar.cc/150?u=cust_firebase_123', '+212612345678'),
('cust_firebase_456', 'amina.alami@email.com', true, 'Amina Alami', 'CUSTOMER', 'https://i.pravatar.cc/150?u=cust_firebase_456', '+212666778899'),
('part_firebase_789', 'owner.sqala@email.com', true, 'Karim Bennani', 'PARTNER', 'https://i.pravatar.cc/150?u=part_firebase_789', '+212655112233'),
('part_firebase_abc', 'manager.tourisme@email.com', true, 'Fatima Zahra', 'PARTNER', 'https://i.pravatar.cc/150?u=part_firebase_abc', '+212644556677'),
('admin_firebase_xyz', 'admin@ydaycasablanca.app', true, 'Admin User', 'ADMIN', 'https://i.pravatar.cc/150?u=admin_firebase_xyz', '+212600000000');

-- 4. PARTNERS
-- Linking partner users to their business entities.
INSERT INTO "partners" ("id", "user_id", "company_name", "company_address", "website_url", "social_media_links") VALUES
('partner_1', 'part_firebase_789', 'La Sqala Restaurant Group', 'Boulevard des Almohades, Casablanca', 'https://www.sqala.ma', '{"instagram": "lasqalaofficiel", "facebook": "LaSqala"}'),
('partner_2', 'part_firebase_abc', 'Casablanca Tourism & Events', '123 Avenue Mohammed V, Casablanca', 'https://www.casatourisme.ma', '{"twitter": "casatourisme", "facebook": "CasaTourisme"}');

-- 5. LISTINGS
-- The core of the app. Assumes PostGIS is enabled. Format: ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
INSERT INTO "listings" (id, "partner_id", "category_id", type, title, description, address, location, "phone_number", "website_url", "opening_hours", "working_days", status, "cancellation_policy", "accessibility_info") VALUES
('listing_1', 'partner_1', 1, 'RESTAURANT', 'La Sqala', 'Historic fortress restaurant offering traditional Moroccan cuisine with a beautiful Andalusian garden.', 'Boulevard des Almohades, Casablanca 20250', ST_SetSRID(ST_MakePoint(-7.6222, 33.6063), 4326), '+212522260960', 'https://www.sqala.ma', '{"from": "12:00", "to": "23:00"}', '{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}', 'PUBLISHED', 'Full refund for cancellations made 24 hours in advance.', 'Partially accessible, some steps present.'),
('listing_2', 'partner_2', 3, 'ACTIVITY', 'Hassan II Mosque Guided Tour', 'Explore one of the largest and most beautiful mosques in the world. Guided tours are available in multiple languages.', 'Boulevard de la Corniche, Casablanca 20000', ST_SetSRID(ST_MakePoint(-7.6328, 33.6083), 4326), '+212522222563', 'https://www.fmh2.ma/fr/', '{"from": "09:00", "to": "16:00"}', '{"Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"}', 'PUBLISHED', 'Non-refundable.', 'Wheelchair accessible with ramps and elevators.'),
('listing_3', 'partner_2', 2, 'CULTURAL', 'Villa des Arts de Casablanca', 'A beautiful Art Deco villa hosting contemporary art exhibitions from Moroccan and international artists.', '30 Boulevard Brahim Roudani, Casablanca 20000', ST_SetSRID(ST_MakePoint(-7.6293, 33.5873), 4326), '+212522295087', 'https://www.fondationona.ma', '{"from": "09:30", "to": "19:00"}', '{"Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}', 'PUBLISHED', 'Free entry, no cancellation needed.', 'Fully accessible.'),
('listing_4', 'partner_1', 1, 'RESTAURANT', 'Rick''s Café', 'A recreation of the mythical saloon from the film "Casablanca," featuring classic design, an international menu, and live jazz.', '248 Boulevard Sour Jdid, Place du jardin public, Casablanca 20250', ST_SetSRID(ST_MakePoint(-7.6247, 33.6053), 4326), '+212522274207', 'http://www.rickscafe.ma/', '{"from": "18:30", "to": "01:00"}', '{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}', 'PUBLISHED', 'Cancellation required 6 hours in advance for a refund.', 'Not specified.');

-- 6. LISTING MEDIA
-- Images and videos for the listings.
INSERT INTO "listing_media" (id, "listing_id", "media_url", "media_type", "is_cover") VALUES
('media_1', 'listing_1', 'https://i.imgur.com/gQf4G3s.jpg', 'IMAGE', true),
('media_2', 'listing_1', 'https://i.imgur.com/rL4J2yW.jpg', 'IMAGE', false),
('media_3', 'listing_2', 'https://i.imgur.com/5J3J3U2.jpg', 'IMAGE', true),
('media_4', 'listing_3', 'https://i.imgur.com/sM8Q2zH.jpg', 'IMAGE', true),
('media_5', 'listing_4', 'https://i.imgur.com/kS9j8A3.jpg', 'IMAGE', true);


-- 7. LISTING AMENITIES (Many-to-Many)
-- Connecting listings with their available amenities.
INSERT INTO "listing_amenities" ("listing_id", "amenity_id") VALUES
('listing_1', 1), ('listing_1', 5), ('listing_1', 6),
('listing_2', 2), ('listing_2', 4), ('listing_2', 6),
('listing_3', 1), ('listing_3', 4),
('listing_4', 1), ('listing_4', 3), ('listing_4', 6);

-- 8. PRICING SCHEDULES
-- Defines available time slots and pricing for bookings.
INSERT INTO "pricing_schedules" (id, "listing_id", "start_time", "end_time", price, currency, capacity, "is_available") VALUES
('sched_1', 'listing_1', '2025-07-15T20:00:00Z', '2025-07-15T22:00:00Z', 350.00, 'MAD', 20, true),
('sched_2', 'listing_2', '2025-07-16T10:00:00Z', '2025-07-16T11:00:00Z', 130.00, 'MAD', 15, true),
('sched_3', 'listing_2', '2025-07-16T14:00:00Z', '2025-07-16T15:00:00Z', 130.00, 'MAD', 15, true),
('sched_4', 'listing_4', '2025-07-18T21:00:00Z', '2025-07-18T23:00:00Z', 500.00, 'MAD', 10, true);

-- 9. BOOKINGS
-- User bookings for specific listing schedules.
INSERT INTO "bookings" (id, "user_id", "listing_id", "schedule_id", "num_participants", "total_price", status) VALUES
('booking_1', 'cust_firebase_123', 'listing_1', 'sched_1', 2, 700.00, 'CONFIRMED'),
('booking_2', 'cust_firebase_456', 'listing_2', 'sched_2', 1, 130.00, 'CONFIRMED'),
('booking_3', 'cust_firebase_123', 'listing_2', 'sched_3', 4, 520.00, 'PENDING'),
('booking_4', 'cust_firebase_456', 'listing_4', 'sched_4', 2, 1000.00, 'AWAITING_PAYMENT');

-- Let's update the booked_slots count in the schedules table
UPDATE "pricing_schedules" SET "booked_slots" = 2 WHERE id = 'sched_1';
UPDATE "pricing_schedules" SET "booked_slots" = 1 WHERE id = 'sched_2';
UPDATE "pricing_schedules" SET "booked_slots" = 4 WHERE id = 'sched_3';
UPDATE "pricing_schedules" SET "booked_slots" = 2 WHERE id = 'sched_4';

-- 10. PAYMENTS
-- Payment records for bookings.
INSERT INTO "payments" (id, "booking_id", "user_id", amount, currency, status, "payment_gateway", "gateway_transaction_id") VALUES
('payment_1', 'booking_1', 'cust_firebase_123', 700.00, 'MAD', 'SUCCEEDED', 'Stripe', 'pi_1'),
('payment_2', 'booking_2', 'cust_firebase_456', 130.00, 'MAD', 'SUCCEEDED', 'CMI', 'cmi_2');

-- 11. REVIEWS
-- User reviews for their completed bookings.
INSERT INTO "reviews" (id, "user_id", "listing_id", "booking_id", rating, comment, "partner_reply") VALUES
('review_1', 'cust_firebase_123', 'listing_1', 'booking_1', 5, 'Absolutely magical experience! The food was divine and the garden is an oasis in the city.', 'Thank you for your kind words! We are delighted you enjoyed your evening at La Sqala.'),
('review_2', 'cust_firebase_456', 'listing_2', 'booking_2', 4, 'The mosque is breathtaking. The tour was very informative but felt a little rushed.', NULL);

-- Let's update the listing's average rating and review count
UPDATE "listings" SET "average_rating" = 5.00, "review_count" = 1 WHERE id = 'listing_1';
UPDATE "listings" SET "average_rating" = 4.00, "review_count" = 1 WHERE id = 'listing_2';


-- 12. FAVORITES
-- Users can mark listings as favorites.
INSERT INTO "favorites" ("user_id", "listing_id") VALUES
('cust_firebase_123', 'listing_3'),
('cust_firebase_123', 'listing_4'),
('cust_firebase_456', 'listing_1');

-- 13. NOTIFICATIONS
-- System notifications for users.
INSERT INTO "notifications" (id, "user_id", type, title, message, "is_read", "related_booking_id") VALUES
('notif_1', 'part_firebase_789', 'NEW_BOOKING_REQUEST', 'New Reservation', 'You have a new reservation for La Sqala for 2 people.', false, 'booking_1'),
('notif_2', 'cust_firebase_123', 'BOOKING_CONFIRMED', 'Reservation Confirmed!', 'Your booking at La Sqala for 2 people has been confirmed.', false, 'booking_1'),
('notif_3', 'cust_firebase_456', 'RESERVATION_REMINDER', 'Reminder: Hassan II Mosque Tour', 'Your guided tour is tomorrow at 10:00 AM. Don''t forget your ticket!', false, 'booking_2');