// Human-readable labels for database status enums (PARTIALLY_PAID -> "Partially paid").
export function formatStatus(status: string) {
  const text = status.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// CSS-friendly modifier for a status (PARTIALLY_PAID -> "partially-paid").
export function statusModifier(status: string) {
  return status.toLowerCase().replaceAll("_", "-");
}
