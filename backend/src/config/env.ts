import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'offlinedrop-dev-secret-change-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || './data/offlinedrop.db',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10), // 10 GB
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100,
};
