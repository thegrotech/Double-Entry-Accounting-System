// Currency formatter for Pakistani Rupees
export const formatCurrency = (amount) => {
  return `Rs. ${new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)}`;
};

export const getCurrencySymbol = () => {
  return '₨'; // Pakistani Rupee symbol
};

// For display without "Rs." prefix (just formatted numbers)
export const formatAmount = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};
