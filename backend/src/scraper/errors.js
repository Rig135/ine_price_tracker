/**
 * Custom error class indicating that the storefront markup or expected structure
 * has changed, preventing accurate extraction of product data.
 */
export class StructureChangeError extends Error {
  /**
   * @param {object} params
   * @param {'MISSING_SELECTOR'|'MISSING_FIELD'|'MALFORMED_FIELD'|'INTERACTION_FAILED'} params.reason
   * @param {string} [params.failedSelector] - The CSS selector that failed to resolve
   * @param {string} [params.missingField] - The product field that could not be found or parsed ('price', 'stock')
   * @param {string} [params.url] - The URL where extraction was attempted
   * @param {string} [params.details] - Additional diagnostic explanation
   * @param {string} [params.pageTitle] - Title of the page when failure occurred
   */
  constructor({ reason, failedSelector = null, missingField = null, url = null, details = null, pageTitle = null }) {
    let diagnosticMsg = `[STRUCTURE_CHANGED] Storefront structure change detected [${reason}]`;
    if (failedSelector) {
      diagnosticMsg += `: Expected selector '${failedSelector}' was not found or visible`;
    }
    if (missingField) {
      diagnosticMsg += `: Missing mandatory field '${missingField}'`;
    }
    if (details) {
      diagnosticMsg += ` (${details})`;
    }
    if (url) {
      diagnosticMsg += ` at ${url}`;
    }
    if (pageTitle) {
      diagnosticMsg += ` [Page Title: "${pageTitle}"]`;
    }

    super(diagnosticMsg);
    this.name = 'StructureChangeError';
    this.errorType = 'STRUCTURE_CHANGED';
    this.reason = reason;
    this.failedSelector = failedSelector;
    this.missingField = missingField;
    this.url = url;
    this.details = details;
    this.pageTitle = pageTitle;
  }
}
