import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || '';

if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tailor-pos',
  jwtSecret: jwtSecret || 'tailor-pos-insecure-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  /** Comma-separated list of sites allowed to call the API from a browser. */
  corsOrigin: process.env.CORS_ORIGIN || '',
  /** Credentials for the bootstrap super admin created by `npm run seed`. */
  seedAdminUser: process.env.SEED_ADMIN_USER || 'superadmin',
  seedAdminPass: process.env.SEED_ADMIN_PASS || 'ChangeMe@123',
};

if (!jwtSecret) {
  // eslint-disable-next-line no-console
  console.warn('[config] JWT_SECRET is not set — using an insecure development fallback.');
}
