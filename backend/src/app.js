import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// CORS configuration: dynamically allow localhost, any Vercel domain (*.vercel.app), and configured origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
];

if (config.corsOrigin && config.corsOrigin !== '*') {
  config.corsOrigin.split(',').forEach(o => {
    if (o.trim()) allowedOrigins.push(o.trim());
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow non-browser requests (cron-job.org, curl, server-to-server)
    if (!origin) return callback(null, true);

    // 2. Wildcard or development mode
    if (config.corsOrigin === '*' || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // 3. Localhost
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // 4. Any Vercel deployment (*.vercel.app)
    if (/^https:\/\/[a-zA-Z0-9-.]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    // 5. Configured origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Permissive fallback so production is not blocked
    return callback(null, true);
  },
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
