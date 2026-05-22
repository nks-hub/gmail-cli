import { extractEmailAddress } from "./message.ts";

/** A sender address paired with how many messages it sent. */
export interface SenderCount {
  address: string;
  count: number;
}

/**
 * Aggregates `From` header values into a ranked list of sender addresses.
 * Results are sorted by descending count, then alphabetically for stability.
 */
export function aggregateSenders(
  fromHeaders: string[],
  topN = 10,
): SenderCount[] {
  const counts = new Map<string, number>();
  for (const header of fromHeaders) {
    const address = extractEmailAddress(header);
    if (address === "") continue;
    counts.set(address, (counts.get(address) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([address, count]) => ({ address, count }))
    .sort((a, b) => b.count - a.count || a.address.localeCompare(b.address))
    .slice(0, Math.max(0, topN));
}
