/** Format a quote amount in pounds, preserving its pence on each customer surface. */
export function formatQuotePrice(pounds: number): string {
  const pence = Math.round(pounds * 100);
  return '£' + (pence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
