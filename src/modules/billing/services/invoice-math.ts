// Invoice arithmetic. All money is handled as integer cents so sums never drift, and these
// pure functions are the single source of truth for invoice totals, balances and status.

type MoneyLike = number | string | { toString(): string };

export const toCents = (value: MoneyLike) => Math.round(Number(value) * 100);

export function computeInvoiceTotals(
  items: { quantity: number; unitPrice: number }[],
  discount: number,
  tax: number,
) {
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100), 0);
  const discountCents = toCents(discount);
  const taxCents = toCents(tax);
  return { subtotalCents, discountCents, taxCents, totalCents: subtotalCents - discountCents + taxCents };
}

export function invoiceTotalCents(invoice: { subtotal: MoneyLike; discount: MoneyLike; tax: MoneyLike }) {
  return toCents(invoice.subtotal) - toCents(invoice.discount) + toCents(invoice.tax);
}

export function paidCents(payments: { amount: MoneyLike }[]) {
  return payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
}

/** Invoice status implied by what has been paid (voided invoices are never recalculated). */
export function statusForPayments(paid: number, total: number) {
  if (paid <= 0) return "ISSUED" as const;
  return paid >= total ? "PAID" as const : "PARTIALLY_PAID" as const;
}

export const formatCents = (cents: number) => (cents / 100).toFixed(2);
