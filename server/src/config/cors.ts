export const getCorsOrigins = (): string[] => {
  const frontendUrl = process.env.FRONTEND_URL;
  const origins = frontendUrl ? frontendUrl.split(',').map(url => url.trim().replace(/\/$/, '')) : [];
  return Array.from(new Set([
    ...origins,
    'https://tripmate-ten-mu.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5000'
  ]));
};

export const allowedOrigins = getCorsOrigins();

export const corsOriginHandler = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (like mobile apps, curl, Postman)
  if (!origin) return callback(null, true);

  const cleanOrigin = origin.trim().replace(/\/$/, '');
  const isLocalDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
  const isWhitelisted = allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*');

  if (isLocalDev || isWhitelisted) {
    return callback(null, true);
  }
  callback(null, false);
};
