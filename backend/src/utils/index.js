// Utility functions placeholder (e.g. price sanitizers, retry helpers)
export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency
  }).format(amount);
};
