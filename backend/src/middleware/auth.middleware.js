import { config } from '../config/env.js';

/**
 * Authentication middleware for cron / scheduled operations.
 * Accepts secret via:
 * 1. Authorization: Bearer <CRON_SECRET>
 * 2. x-cron-secret: <CRON_SECRET>
 * 3. Query param: ?secret=<CRON_SECRET>
 */
export const requireCronAuth = (req, res, next) => {
  const configuredSecret = config.cronSecret;

  if (!configuredSecret && config.nodeEnv === 'development') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const customHeader = req.headers['x-cron-secret'];
  const querySecret = req.query.secret;

  const providedSecret = bearerToken || customHeader || querySecret;

  if (!providedSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Unauthorized: Invalid or missing cron secret'
      }
    });
  }

  next();
};
