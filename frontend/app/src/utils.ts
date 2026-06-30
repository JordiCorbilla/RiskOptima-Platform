export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatMetric(value: number, unit: string): string {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  if (unit === "currency") {
    return formatCurrency(value);
  }
  return formatPercent(value);
}
