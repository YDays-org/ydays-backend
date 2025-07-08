import { cloudinary } from '@casablanca/common';
import fs from 'fs/promises';

export const getMediaType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'IMAGE';
  if (mimetype.startsWith('video/')) return 'VIDEO';
  return 'IMAGE'; // Default fallback
};

// Helper for uploading a file from a temp path.
export const uploadFileToCloudinary = (localFilePath, options = {}) => {
  return cloudinary.uploader.upload(localFilePath, {
    resource_type: 'auto',
    folder: 'listings',
    ...options,
  });
};

// Helper to safely delete a file from Cloudinary during rollbacks.
export const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Failed to delete asset ${publicId} from Cloudinary during rollback:`, error);
  }
};

// Helper to safely clean up a temporary file from the local disk.
export const cleanupTempFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.warn(`Failed to delete temporary file: ${filePath}`, err);
  }
};