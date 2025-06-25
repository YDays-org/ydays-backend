import prisma from "../../lib/prisma.js";

export const getNotifications = async (req, res) => {
  const { id: userId } = req.user;
  const { page, limit } = req.query;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.notification.count({ where: { userId } });

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch notifications.", error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  const { id: notificationId } = req.params;
  const { id: userId } = req.user;

  try {
    const updatedNotification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure users can only mark their own notifications as read
      },
      data: { isRead: true },
    });

    if (updatedNotification.count === 0) {
      return res.status(404).json({ success: false, message: "Notification not found or you do not have permission to update it." });
    }

    res.status(200).json({ success: true, message: "Notification marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to mark notification as read.", error: error.message });
  }
};
