import prisma from "../../lib/prisma.js";
import admin from "../../config/firebase.js";

// --- Category Handlers ---
export const createCategory = async (req, res) => {
  try {
    const category = await prisma.category.create({
      data: req.body,
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A category with this name or slug already exists.' });
    }
    res.status(500).json({ success: false, message: "Failed to create category.", error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: req.body,
    });
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    res.status(500).json({ success: false, message: "Failed to update category.", error: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const categoryId = parseInt(id);

  try {
    // Check if any listings are using this category
    const listingCount = await prisma.listing.count({
      where: { categoryId: categoryId },
    });

    if (listingCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete category because it is associated with ${listingCount} listing(s).`
      });
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    res.status(500).json({ success: false, message: "Failed to delete category.", error: error.message });
  }
};

// --- Amenity Handlers ---
export const createAmenity = async (req, res) => {
  try {
    const amenity = await prisma.amenity.create({
      data: req.body,
    });
    res.status(201).json({ success: true, data: amenity });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'An amenity with this name already exists.' });
    }
    res.status(500).json({ success: false, message: "Failed to create amenity.", error: error.message });
  }
};

export const updateAmenity = async (req, res) => {
  const { id } = req.params;
  try {
    const amenity = await prisma.amenity.update({
      where: { id: parseInt(id) },
      data: req.body,
    });
    res.status(200).json({ success: true, data: amenity });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Amenity not found.' });
    }
    res.status(500).json({ success: false, message: "Failed to update amenity.", error: error.message });
  }
};

export const deleteAmenity = async (req, res) => {
  const { id } = req.params;
  const amenityId = parseInt(id);
  try {
    // Check if any listings are using this amenity
    const listingCount = await prisma.listingAmenity.count({
      where: { amenityId: amenityId }
    });

    if (listingCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete amenity because it is in use by ${listingCount} listing(s).`
      });
    }

    await prisma.amenity.delete({
      where: { id: amenityId },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Amenity not found.' });
    }
    res.status(500).json({ success: false, message: "Failed to delete amenity.", error: error.message });
  }
};

// --- User Management Handlers ---
export const listUsers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    const users = await prisma.user.findMany({
      skip: skip,
      take: take,
      orderBy: { createdAt: "desc" },
    });

    const totalFromDb = await prisma.user.count();
    const total = Number(totalFromDb);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch users.", error: error.message });
  }
};

export const getUserById = async (req, res) => {
  const { id: userId } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Failed to get user", error: error.message });

  }
}

export const updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role: newRole } = req.body;
  let oldRole = null;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log(user)

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    oldRole = user.role;

    if (oldRole === newRole) {
      return res.status(200).json({
        success: true,
        message: "User role is already set to the desired value.",
        data: user
      });
    }

    await admin.auth().setCustomUserClaims(userId, { role: newRole });

    // Now, update our local database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    res.status(200).json({ success: true, message: "User role updated successfully.", data: updatedUser });
  } catch (error) {
    // If the database update fails after Firebase was updated, we must attempt a rollback.
    if (oldRole) {
      console.error(`CRITICAL: Database update failed for user ${userId} after Firebase role was set to ${newRole}. Attempting rollback...`, error);
      try {
        await admin.auth().setCustomUserClaims(userId, { role: oldRole });
        console.log(`Successfully rolled back Firebase claims for user ${userId} to ${oldRole}.`);
      } catch (rollbackError) {
        console.error(`CRITICAL FAILURE: Could not roll back Firebase claims for user ${userId}. MANUAL INTERVENTION REQUIRED.`, rollbackError);
      }
    }
    res.status(500).json({ success: false, message: "Failed to update user role.", error: error.message });
  }
}; 