import pLimit from 'p-limit';
import prisma from '../../lib/prisma.js';
import { getMediaType, cleanupTempFile, deleteFromCloudinary, uploadFileToCloudinary } from './utils/helpers.js';

export const uploadSingleMedia = async (req, res) => {
  const { listingId, caption, isCover } = req.body;
  const file = req.file;
  const partnerId = req.user.id;
  let uploadedAssetPublicId = null;

  if (!file) {
    return res.status(400).json({ error: 'No file was uploaded.' });
  }

  console.log('Received file for upload:', req.body);

  try {
    const savedMedia = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findFirst({ where: { id: listingId, partnerId } });
      if (!listing) {
        throw new Error('Listing not found or you do not have permission to upload to it.');
      }

      const cloudinaryResult = await uploadFileToCloudinary(file.path, {
        public_id: `listing_${listingId}_${Date.now()}`,
      });
      uploadedAssetPublicId = cloudinaryResult.public_id;

      return tx.listingMedia.create({
        data: {
          listingId,
          mediaUrl: cloudinaryResult.secure_url,
          mediaType: getMediaType(file.mimetype),
          caption: caption || null,
          isCover: Boolean(isCover),
        },
      });
    });

    res.status(201).json({ success: true, data: savedMedia });

  } catch (error) {
    console.error('Single upload transaction failed:', error);
    if (uploadedAssetPublicId) {
      await deleteFromCloudinary(uploadedAssetPublicId);
    }
    const statusCode = error.message.startsWith('Listing not found') ? 404 : 500;
    res.status(statusCode).json({ error: 'Failed to process upload.', details: error.message });

  } finally {
    // ALWAYS clean up the temp file after the operation completes.
    await cleanupTempFile(file.path);
  }
};

export const uploadMultipleMedia = async (req, res) => {
  const { listingId, captions } = req.body;
  const files = req.files;
  const partnerId = req.user?.id;
  const uploadedAssets = []; // Store { public_id, path } for rollback and cleanup

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  // Set concurrency limit to 5 to avoid overwhelming APIs.
  const limit = pLimit(5);

  try {
    const savedMedias = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findFirst({ where: { id: listingId, partnerId } });
      if (!listing) throw new Error('Listing not found or you do not have permission to upload to it.');

      const uploadPromises = files.map((file, index) =>
        limit(async () => {
          const result = await uploadFileToCloudinary(file.path, {
            public_id: `listing_${listingId}_${Date.now()}_${index}`,
          });
          // Track successfully uploaded assets for potential rollback
          uploadedAssets.push({ public_id: result.public_id, path: file.path });
          return result;
        })
      );

      const cloudinaryResults = await Promise.all(uploadPromises);

      const mediaDataArray = cloudinaryResults.map((result, index) => ({
        listingId,
        mediaUrl: result.secure_url,
        mediaType: getMediaType(files[index].mimetype),
        caption: Array.isArray(captions) ? (captions[index] || null) : null,
        isCover: index === 0,
      }));

      await tx.listingMedia.createMany({ data: mediaDataArray });

      return tx.listingMedia.findMany({
        where: { mediaUrl: { in: mediaDataArray.map(m => m.mediaUrl) } }
      });
    });

    res.status(201).json({ success: true, data: savedMedias });

  } catch (error) {
    console.error('Multiple upload transaction failed:', error);

    // Rollback all successfully uploaded assets from Cloudinary
    if (uploadedAssets.length > 0) {
      await Promise.all(uploadedAssets.map(asset => deleteFromCloudinary(asset.public_id)));
    }

    const statusCode = error.message.startsWith('Listing not found') ? 404 : 500;
    res.status(statusCode).json({ error: 'Failed to process uploads.', details: error.message });

  } finally {
    // ALWAYS clean up all temp files from disk
    await Promise.all(files.map(file => cleanupTempFile(file.path)));
  }
};