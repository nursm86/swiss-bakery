import crypto from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { logger } from "../lib/logger.js";
import { authRequired } from "../middleware/authRequired.js";
import { HttpError } from "../middleware/errorHandler.js";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Resolve uploads dir from this module's own location, NOT process.cwd().
// Layout: <repo>/apps/api/{src|dist}/routes/uploads.{ts|js} → 4 levels up from this file.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "..", "..", "..", "..", "public", "uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new HttpError(400, "Unsupported image type"));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter: Router = Router();

uploadsRouter.post("/", authRequired, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No image field");
    const hash = crypto.createHash("sha1").update(req.file.buffer).digest("hex").slice(0, 16);
    const fileName = `${Date.now().toString(36)}-${hash}.webp`;
    await mkdir(UPLOADS_DIR, { recursive: true });
    const diskPath = path.join(UPLOADS_DIR, fileName);

    try {
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(diskPath);
    } catch (sharpErr) {
      logger.error(
        { err: sharpErr, dir: UPLOADS_DIR, fileName },
        "sharp failed to write upload",
      );
      throw new HttpError(500, "Image processing failed");
    }

    res.status(201).json({ imagePath: `/uploads/${fileName}` });
  } catch (e) {
    next(e);
  }
});
