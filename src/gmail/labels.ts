import type { GmailClient } from "./client.ts";

/**
 * Resolves a list of label names or IDs to label IDs. Each entry is matched
 * first as an exact ID, then case-insensitively by name. Throws on any entry
 * that does not match an existing label.
 */
export async function resolveLabelIds(
  client: GmailClient,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return [];
  const labels = await client.listLabels();
  return names.map((name) => {
    const match =
      labels.find((label) => label.id === name) ??
      labels.find(
        (label) => label.name.toLowerCase() === name.toLowerCase(),
      );
    if (!match) throw new Error(`Unknown label: ${name}`);
    return match.id;
  });
}
