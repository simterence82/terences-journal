export function formatSGD(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : ""}S$${formatted}`;
}
