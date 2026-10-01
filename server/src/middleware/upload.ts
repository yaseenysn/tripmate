import multer from 'multer';
import { Request } from 'express';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/heic',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic',
  '.pdf', '.doc', '.docx', '.txt', '.csv', '.xls', '.xlsx'
];

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);

  if (isMimeAllowed || isExtAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: "${file.originalname}". Only images (JPG, PNG, WEBP, GIF, SVG) and documents (PDF, DOC, DOCX, TXT, CSV, XLS) are allowed.`));
  }
};

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});
