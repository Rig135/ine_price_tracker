import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : [config.corsOrigin, 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: `Route ${req.method} ${req.originalUrl} not found` }
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
