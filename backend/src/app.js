import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.js';
import logger from './config/logger.js';

const app = express();

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorHandler);

export default app;
