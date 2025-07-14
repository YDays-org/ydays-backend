import prisma from "../../lib/prisma.js";

export const getNotifications = async (req, res) => {
  const { id: userId } = req.user;
  const { page = 1, limit = 20 } = req.query;

  try {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      skip,
      take,
      orderBy: { createdAt: "desc" },
    });

    const totalFromDb = await prisma.notification.count({ where: { userId } });
    const total = Number(totalFromDb);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,             
        totalPages: Math.ceil(total / take),
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
        userId,
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
