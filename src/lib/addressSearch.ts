/** Case-insensitive substring filter on customer_ref; an empty query returns everything. */
export function filterAddressesByRef<T extends { customer_ref: string | null }>(
  addresses: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return addresses;
  return addresses.filter((a) => (a.customer_ref ?? "").toLowerCase().includes(q));
}
