import dotenv from 'dotenv';
import app from './app.js';
import logger from './config/logger.js';
import prisma from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Verify Database Connection
    await prisma.$connect();
    logger.info('Successfully connected to PostgreSQL database');

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (err) {
    logger.error('Failed to connect to database or start server: %o', err);
    process.exit(1);
  }
}

startServer();
// Server updated with sub-category database schema

