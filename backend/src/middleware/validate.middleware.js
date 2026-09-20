const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates route parameters that must be valid UUIDs
 */
export const validateUuidParam = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !UUID_REGEX.test(value)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid route parameter '${paramName}'. Must be a valid UUID.`
        }
      });
    }
    next();
  };
};

/**
 * Validates search query parameter
 */
export const validateSearchQuery = (req, res, next) => {
  const q = req.query.q;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Query parameter 'q' is required and must not be empty."
      }
    });
  }
  req.query.q = q.trim();
  next();
};

/**
 * Validates payload for tracking a product
 */
export const validateTrackProduct = (req, res, next) => {
  const { externalStoreId, external_store_id, name, storeUrl, store_url } = req.body || {};

  const storeId = externalStoreId !== undefined ? externalStoreId : external_store_id;
  const numStoreId = Number(storeId);

  if (storeId === undefined || storeId === null || isNaN(numStoreId) || numStoreId <= 0 || !Number.isInteger(numStoreId)) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Invalid or missing 'externalStoreId'. Must be a positive integer."
      }
    });
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Invalid or missing 'name'. Product name must not be empty."
      }
    });
  }

  // Sanitize and normalize payload on req.cleanBody
  req.cleanBody = {
    externalStoreId: numStoreId,
    name: name.trim(),
    brand: req.body.brand ? String(req.body.brand).trim() : null,
    category: req.body.category ? String(req.body.category).trim() : null,
    sku: req.body.sku ? String(req.body.sku).trim() : null,
    imageUrl: req.body.imageUrl || req.body.image_url || null,
    storeUrl: storeUrl || store_url || `https://demo.inelabteamdev.com/product/${numStoreId}`,
    trackingStatus: req.body.trackingStatus || req.body.tracking_status || 'active'
  };

  next();
};
