import crypto from "node:crypto";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { authRequired } from "../middleware/authRequired.js";
import { HttpError } from "../middleware/errorHandler.js";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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
    const diskPath = path.join(process.cwd(), "..", "..", "public", "uploads", fileName);

    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(diskPath);

    res.status(201).json({ imagePath: `/uploads/${fileName}` });
  } catch (e) {
    next(e);
  }
});
