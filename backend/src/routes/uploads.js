import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticate } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router    = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure Cloudinary if keys are set, otherwise fall back to local storage
const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary image storage enabled');
} else {
  console.log('⚠️  No Cloudinary config — using local storage (not suitable for production)');
}

// Use memory storage so we can pipe to Cloudinary OR write to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Images only'));
  },
});

async function handleUpload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  if (useCloudinary) {
    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'dropzone/listings', transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }] },
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });
    return res.json({ url: result.secure_url, publicId: result.public_id });
  }

  // Fallback: local disk (dev only)
  const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext      = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);
  return res.json({ url: `/uploads/${filename}`, publicId: filename });
}

router.post('/image',  authenticate, upload.single('image'), handleUpload);
router.post('/avatar', authenticate, upload.single('image'), handleUpload);

export default router;
