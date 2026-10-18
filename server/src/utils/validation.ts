import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * Validates whether a value is a valid 24-character hexadecimal MongoDB ObjectId string.
 */
export const isValidObjectId = (id: unknown): boolean => {
  if (typeof id !== 'string') return false;
  const clean = id.trim();
  return clean.length === 24 && /^[0-9a-fA-F]{24}$/.test(clean) && mongoose.Types.ObjectId.isValid(clean);
};

/**
 * Validates whether a URL uses only safe protocols (HTTP/HTTPS) or is a clean relative path.
 * Explicitly rejects dangerous schemes like javascript:, data:, file:, vbscript:.
 */
export const isValidUrl = (url: unknown, allowRelative = true): boolean => {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Relative path validation
  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates standard email address format using RFC-compliant pattern.
 */
export const isValidEmail = (email: unknown): boolean => {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
};

/**
 * Validates numeric values within a specified range.
 */
export const isValidNumber = (val: unknown, min = -Infinity, max = Infinity): boolean => {
  if (val === null || val === undefined || val === '') return false;
  const num = Number(val);
  return !isNaN(num) && isFinite(num) && num >= min && num <= max;
};

/**
 * Validates that input is a safe string within length bounds.
 * Preserves international characters (Malayalam, Hindi, Arabic, Chinese, etc.), Unicode, and punctuation.
 */
export const isSafeString = (val: unknown, minLength = 0, maxLength = 10000): boolean => {
  if (typeof val !== 'string') return false;
  const len = val.length;
  const trimmedLen = val.trim().length;
  return trimmedLen >= minLength && len <= maxLength;
};

/**
 * Recursively inspects objects and arrays to detect MongoDB/NoSQL query operators
 * (keys starting with '$' or containing '.').
 */
export const hasNoSqlInjection = (input: unknown): boolean => {
  if (!input || typeof input !== 'object') return false;

  if (Array.isArray(input)) {
    return input.some(item => hasNoSqlInjection(item));
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) {
      return true;
    }
    if (value && typeof value === 'object') {
      if (hasNoSqlInjection(value)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Express middleware to reject any request containing NoSQL operators ($gt, $ne, etc.)
 * in body, query, or params.
 */
export const noSqlSanitizerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (hasNoSqlInjection(req.body) || hasNoSqlInjection(req.query) || hasNoSqlInjection(req.params)) {
    return res.status(400).json({
      error: 'Invalid request: NoSQL query operators and forbidden characters are prohibited.'
    });
  }
  next();
};

/**
 * Express middleware to validate that specific route parameters are valid MongoDB ObjectIds.
 */
export const validateObjectIdParams = (...paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const val = req.params[name];
      if (val && !isValidObjectId(val)) {
        return res.status(400).json({
          error: `Invalid ${name} format. Expected a 24-character hexadecimal ObjectId.`
        });
      }
    }
    next();
  };
};

/**
 * Standard route error handler:
 * - Maps Mongoose ValidationError and CastError to safe HTTP 400 responses
 * - Hides internal database implementation details, collections, and stack traces on 500
 * - Optionally passes unhandled errors to Express centralized error handler
 */
export const handleRouteError = (
  error: any,
  res: Response,
  fallbackMessage = 'Internal server error',
  next?: NextFunction
) => {
  if (error?.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${error.path || 'identifier'} format` });
  }
  if (error?.name === 'ValidationError') {
    const errorDetails = error.errors
      ? Object.values(error.errors).map((e: any) => (e as any).message).join('; ')
      : error.message;
    return res.status(400).json({ error: `Validation error: ${errorDetails}` });
  }
  if (next) {
    return next(error);
  }
  console.error(`[Route Error] ${fallbackMessage}:`, error);
  return res.status(500).json({ error: fallbackMessage });
};

