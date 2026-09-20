import { StructureChangeError } from './errors.js';

/**
 * Validates the extracted product data to ensure zero garbage is written to the database.
 * Strip zero-width spaces and parse numeric values.
 */

function sanitizeAndParsePrice(rawPrice) {
    if (!rawPrice || typeof rawPrice !== 'string') return null;
    
    // Remove zero-width spaces, non-breaking spaces, currency symbols (₹, $, Rs, Rs.), commas, and regular spaces
    const cleanStr = rawPrice
        .replace(/[\u200B\u00A0\s]/g, '')
        .replace(/[₹$,]|Rs\.?/gi, '');
    
    // Extract first number (allowing negative to test rejection of negative values)
    const match = cleanStr.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    
    const price = parseFloat(match[0]);
    if (isNaN(price) || price <= 0) {
        return null;
    }
    return price;
}

function sanitizeAndParseStock(rawStock) {
    if (rawStock === undefined || rawStock === null || typeof rawStock !== 'string') return null;
    
    // e.g. "In Stock (12)" or "Out of Stock" or "Selling fast — 118 left" or "12"
    const cleanStr = rawStock.replace(/[\u200B\u00A0\s]/g, '');
    if (!cleanStr) return null;
    
    // If it contains out of stock
    if (cleanStr.toLowerCase().includes('outofstock')) {
        return 0;
    }
    
    const matches = cleanStr.match(/-?\d+/);
    if (!matches) {
        return null;
    }
    
    const stock = parseInt(matches[0], 10);
    if (isNaN(stock) || stock < 0) {
        return null;
    }
    return stock;
}

function validateProductData(extractedData) {
    if (!extractedData) {
        throw new StructureChangeError({
            reason: 'MISSING_FIELD',
            details: 'No extraction data provided'
        });
    }

    const { rawPrice, rawStock, url } = extractedData;
    
    if (rawPrice === undefined || rawPrice === null || typeof rawPrice !== 'string' || rawPrice.trim() === '') {
        throw new StructureChangeError({
            reason: 'MISSING_FIELD',
            missingField: 'price',
            url,
            details: `Raw price element was missing or produced empty string (received: ${JSON.stringify(rawPrice)})`
        });
    }

    if (rawStock === undefined || rawStock === null || typeof rawStock !== 'string' || rawStock.trim() === '') {
        throw new StructureChangeError({
            reason: 'MISSING_FIELD',
            missingField: 'stock',
            url,
            details: `Raw stock element was missing or produced empty string (received: ${JSON.stringify(rawStock)})`
        });
    }

    const price = sanitizeAndParsePrice(rawPrice);
    const stock = sanitizeAndParseStock(rawStock);

    if (price === null) {
        throw new StructureChangeError({
            reason: 'MALFORMED_FIELD',
            missingField: 'price',
            url,
            details: `Invalid price extracted: "${rawPrice}"`
        });
    }

    if (stock === null) {
        throw new StructureChangeError({
            reason: 'MALFORMED_FIELD',
            missingField: 'stock',
            url,
            details: `Invalid stock extracted: "${rawStock}"`
        });
    }

    return {
        price,
        stock,
        url
    };
}

export {
    sanitizeAndParsePrice,
    sanitizeAndParseStock,
    validateProductData
};

