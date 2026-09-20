import { StructureChangeError } from './errors.js';

/**
 * Validates the extracted product data to ensure zero garbage is written to the database.
 * Strip zero-width spaces and parse numeric values.
 */

function sanitizeAndParsePrice(rawPrice) {
    if (!rawPrice || typeof rawPrice !== 'string') return null;
    
    // 1. Normalize unicode (converts fullwidth digits like １２３ to standard 123)
    let s = rawPrice.normalize('NFKC');
    
    // 2. Strip invisible zero-width characters (zero-width space \u200B, non-joiner \u200C, joiner \u200D, BOM \uFEFF)
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // 3. Remove "Deal price", "MRP", and currency labels/symbols
    s = s.replace(/deal\s*price/gi, '').replace(/mrp/gi, '');
    s = s.replace(/[₹$€£]|Rs\.?/gi, '');
    
    // 4. Remove trailing notes like '/- (incl. of all taxes)' or '/-'
    s = s.replace(/\/-\s*\(.*?\)/gi, '').replace(/\/-\s*$/g, '');
    
    // 5. Remove whitespace and non-breaking spaces
    s = s.replace(/[\u00A0\s]/g, '');
    
    // 6. Handle European number format (e.g. 1.299,00) vs standard (1,299.00)
    if (/\d+\.\d{3},\d{2}/.test(s)) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else {
        s = s.replace(/,/g, '');
    }
    
    // Extract first number (allowing leading negative sign to catch invalid negative data)
    const match = s.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    
    const price = parseFloat(match[0]);
    if (isNaN(price) || price <= 0) {
        return null;
    }
    
    return Math.round(price * 100) / 100;
}

function sanitizeAndParseStock(rawStock) {
    if (rawStock === undefined || rawStock === null || typeof rawStock !== 'string') return null;
    
    let s = rawStock.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
    const cleanStr = s.replace(/[\u00A0\s]/g, '');
    if (!cleanStr) return null;
    
    // e.g. "In Stock (12)" or "Out of Stock" or "Selling fast — 118 left" or "12"
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

