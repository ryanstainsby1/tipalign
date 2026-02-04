export function formatMoney(amountInPence, currency = "GBP") {
  const symbols = { GBP: "£", USD: "$", EUR: "€" };
  const symbol = symbols[currency] || currency;
  const pounds = (amountInPence / 100).toFixed(2);
  return `${symbol}${pounds}`;
}