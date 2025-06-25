import prisma from "../../lib/prisma.js";
import { startOfDay, endOfDay } from "date-fns";

export const getAvailability = async (req, res) => {
  const { listingId, date } = req.query;

  const startDate = startOfDay(new Date(date));
  const endDate = endOfDay(new Date(date));

  try {
    const schedules = await prisma.pricingSchedule.findMany({
      where: {
        listingId,
        isAvailable: true,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        price: true,
        capacity: true,
        bookedSlots: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // Calculate available slots for each schedule
    const availability = schedules.map((schedule) => ({
      ...schedule,
      availableSlots: schedule.capacity - schedule.bookedSlots,
    }));

    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch availability.", error: error.message });
  }
};

export const createReservation = async (req, res) => {
  const { scheduleId, numParticipants } = req.body;
  const { id: userId } = req.user;

  try {
    const newBooking = await prisma.$transaction(async (tx) => {
      const schedule = await tx.pricingSchedule.findUnique({
        where: { id: scheduleId },
      });

      if (!schedule) {
        throw new Error("Pricing schedule not found.");
      }
      if (!schedule.isAvailable) {
        throw new Error("This time slot is no longer available.");
      }

      const availableSlots = schedule.capacity - schedule.bookedSlots;
      if (numParticipants > availableSlots) {
        throw new Error(`Not enough available slots. Only ${availableSlots} left.`);
      }

      // 2. Update the booked slots
      await tx.pricingSchedule.update({
        where: { id: scheduleId },
        data: {
          bookedSlots: {
            increment: numParticipants,
          },
        },
      });

      // 3. Create the booking
      const totalPrice = schedule.price * numParticipants;
      const booking = await tx.booking.create({
        data: {
          userId,
          listingId: schedule.listingId,
          scheduleId,
          numParticipants,
          totalPrice,
          status: "pending", // Or 'confirmed' if no payment step
        },
      });

      return booking;
    });

    res.status(201).json({ success: true, data: newBooking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getReservations = async (req, res) => {
  const { id: userId } = req.user;
  const { page, limit, status } = req.query;

  const where = {
    userId,
    ...(status && { status }),
  };

  try {
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        listing: {
          select: { id: true, title: true, address: true },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    const total = await prisma.booking.count({ where });

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reservations.", error: error.message });
  }
};

export const getReservationById = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        listing: true,
        schedule: true,
      },
    });

    if (!booking || booking.userId !== userId) {
      return res.status(404).json({ success: false, message: "Booking not found or you do not have permission to view it." });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch reservation.", error: error.message });
  }
};

export const cancelReservation = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;

  try {
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (!booking || booking.userId !== userId) {
        throw new Error("Booking not found or you do not have permission to cancel it.");
      }

      if (booking.status === "cancelled" || booking.status === "completed") {
        throw new Error(`Booking cannot be cancelled as it is already ${booking.status}.`);
      }

      // Restore the booked slots
      await tx.pricingSchedule.update({
        where: { id: booking.scheduleId },
        data: {
          bookedSlots: {
            decrement: booking.numParticipants,
          },
        },
      });

      // Update the booking status
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: { status: "cancelled" },
      });

      return cancelledBooking;
    });

    res.status(200).json({ success: true, message: "Booking cancelled successfully.", data: updatedBooking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
