-- YDAYS 2025 - Casablanca Discovery Platform
-- FINAL CONSOLIDATED & PROFESSIONAL Database Schema
--
-- Version: 2.1 (Corrected and Patched)
-- Changelog:
-- - Patched all inconsistencies with the Prisma schema.
-- - Changed the primary key of the 'users' table to VARCHAR(255) to support Firebase UID.
-- - Removed the 'password_hash' column from the 'users' table.
-- - Updated all foreign keys referencing 'users.id' to VARCHAR(255).
-- - Added 'AWAITING_PAYMENT' to the 'booking_status' enum.
-- - Created a 'notification_type' enum to match the Prisma schema.
-- - Added a UNIQUE constraint to 'booking_id' in the 'payments' table.
-- - All changes from v2.0 are included.

-- PRELIMINARIES --
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- CUSTOM TYPES --
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('CUSTOMER', 'PARTNER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE listing_type AS ENUM ('ACTIVITY', 'EVENT', 'RESTAURANT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE listing_status AS ENUM ('PUBLISHED', 'DRAFT', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'AWAITING_PAYMENT'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ★ NEW ★ ENUMs for new features
DO $$ BEGIN
    CREATE TYPE promotion_type AS ENUM (
        'PERCENTAGE_DISCOUNT',
        'FIXED_AMOUNT_DISCOUNT',
        'VISIBILITY_BOOST'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'PENDING',
        'SUCCEEDED',
        'FAILED',
        'REFUNDED',
        'PARTIALLY_REFUNDED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'NEW_BOOKING_REQUEST',
        'USER_CANCELLED_BOOKING',
        'BOOKING_PAID',
        'BOOKING_APPROVED_FOR_PAYMENT',
        'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED_BY_PARTNER',
        'BOOKING_MODIFIED',
        'RESERVATION_REMINDER'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- TABLE DEFINITIONS --

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    full_name VARCHAR(100),
    role user_role NOT NULL,
    profile_picture_url TEXT,
    phone_number VARCHAR(50),
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    device_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_token)
);

CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_address TEXT,
    website_url TEXT,
    social_media_links JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id),
    category_id INT REFERENCES categories(id),
    type listing_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    phone_number VARCHAR(50),
    website_url TEXT,
    opening_hours JSONB,
    working_days TEXT[],
    metadata JSONB,
    cancellation_policy TEXT,
    accessibility_info TEXT,
    status listing_status NOT NULL DEFAULT 'DRAFT',
    average_rating NUMERIC(3, 2) DEFAULT 0,
    review_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amenities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon_url TEXT
);

CREATE TABLE IF NOT EXISTS listing_amenities (
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    amenity_id INT NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (listing_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS listing_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type media_type NOT NULL,
    caption TEXT,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS pricing_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MAD',
    capacity INT,
    booked_slots INT NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(listing_id, start_time)
);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    listing_id UUID NOT NULL REFERENCES listings(id),
    schedule_id UUID NOT NULL REFERENCES pricing_schedules(id),
    num_participants INT NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    status booking_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    partner_reply TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_listing_id UUID REFERENCES listings(id),
    related_booking_id UUID REFERENCES bookings(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ★★★ NEW & IMPROVED TABLES ★★★

-- 1. Promotions Engine
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type promotion_type NOT NULL,
    value NUMERIC(10, 2) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_promotions (
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    PRIMARY KEY (listing_id, promotion_id)
);

-- 2. Partner Analytics Table
CREATE TABLE IF NOT EXISTS listing_daily_stats (
    id BIGSERIAL PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    view_count INT NOT NULL DEFAULT 0,
    booking_count INT NOT NULL DEFAULT 0,
    UNIQUE (listing_id, stat_date)
);

-- 3. Dedicated Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDING',
    payment_gateway VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    payment_method_details JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- INDEXES FOR PERFORMANCE --

-- Critical spatial index for geolocation
CREATE INDEX IF NOT EXISTS listings_location_idx ON listings USING GIST (location);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS listings_title_search_idx ON listings USING GIN (to_tsvector('french', title));
CREATE INDEX IF NOT EXISTS listings_description_search_idx ON listings USING GIN (to_tsvector('french', description));

-- Indexes for common filtering operations
CREATE INDEX IF NOT EXISTS listings_type_status_idx ON listings(type, status);
CREATE INDEX IF NOT EXISTS pricing_schedules_price_idx ON pricing_schedules(price);

-- Standard foreign key and query indexes
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_listing_id_idx ON bookings(listing_id);
CREATE INDEX IF NOT EXISTS reviews_listing_id_idx ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS pricing_schedules_listing_id_idx ON pricing_schedules(listing_id);
CREATE INDEX IF NOT EXISTS pricing_schedules_start_time_idx ON pricing_schedules(start_time);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);

-- ★ NEW ★ Indexes for Added Tables
CREATE INDEX IF NOT EXISTS idx_promotions_partner_id ON promotions(partner_id);
CREATE INDEX IF NOT EXISTS idx_listing_daily_stats_date ON listing_daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);