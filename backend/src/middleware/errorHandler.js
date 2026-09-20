/**
 * Centralized Global Error Handler
 * Sanitizes errors, maps DB error codes, and prevents secrets from leaking.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle PostgreSQL / Supabase constraint error codes cleanly
  if (err.code === '23505') {
    statusCode = 409;
    message = 'Resource already exists (duplicate key constraint).';
  } else if (err.code === 'PGRST116') {
    statusCode = 404;
    message = 'Requested resource not found.';
  } else if (err.message && (err.message.includes('Validation Error') || err.message.includes('required'))) {
    statusCode = 400;
  }

  // Strict rule: Never expose secrets, credentials, or API keys in response
  if (message.includes('SUPABASE_') || message.includes('Bearer') || message.includes('KEY') || message.includes('SECRET')) {
    message = 'A server error occurred. Please contact the system administrator.';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};
