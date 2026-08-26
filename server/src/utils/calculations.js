/**
 * Financial Calculation Utilities for Bachat Gat
 */

/**
 * Calculates monthly interest amount on principal based on monthly interest rate percentage
 * Formula: Interest = (Principal * InterestRatePercent) / 100
 * Example: 1000 * 2% = 20.00
 */
function calculateMonthlyInterest(principal, monthlyRatePercent) {
  const p = parseFloat(principal) || 0;
  const r = parseFloat(monthlyRatePercent) || 0;
  const interest = (p * r) / 100;
  return Math.round(interest * 100) / 100;
}

/**
 * Calculates total repayment amount
 * Total Payment = Regular Hafta + Principal Repayment + Interest Amount
 */
function calculateTotalPayment(regularHafta, principalRepayment, interestAmount) {
  const h = parseFloat(regularHafta) || 0;
  const p = parseFloat(principalRepayment) || 0;
  const i = parseFloat(interestAmount) || 0;
  return Math.round((h + p + i) * 100) / 100;
}

/**
 * Calculates progress percentage for monthly savings
 * Progress = (Collected / Target) * 100
 */
function calculateProgressPercentage(collected, target) {
  const c = parseFloat(collected) || 0;
  const t = parseFloat(target) || 0;
  if (t <= 0) return 0;
  const pct = (c / t) * 100;
  return Math.min(Math.round(pct * 10) / 10, 100);
}

module.exports = {
  calculateMonthlyInterest,
  calculateTotalPayment,
  calculateProgressPercentage,
};
