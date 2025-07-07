/*
  Warnings:

  - Changed the type of `type` on the `notifications` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_BOOKING_REQUEST', 'USER_CANCELLED_BOOKING', 'BOOKING_PAID', 'BOOKING_APPROVED_FOR_PAYMENT', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED_BY_PARTNER', 'BOOKING_MODIFIED', 'RESERVATION_REMINDER');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterEnum
ALTER TYPE "PromotionType" ADD VALUE 'partially_refunded';

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL;
