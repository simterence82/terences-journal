export function formatSGD(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${amount < 0 ? "-" : ""}S$${formatted}`;
}
