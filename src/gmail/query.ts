/**
 * Quotes a Gmail search value when it contains whitespace, so multi-word
 * values such as a display name are treated as a single search term.
 */
export function quoteValue(value: string): string {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/** Combines query fragments with implicit AND semantics, dropping empties. */
export function combineQuery(
  parts: Array<string | undefined | null>,
): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .join(" ")
    .trim();
}

/** Builds a `from:` query fragment for the given sender address. */
export function fromSender(address: string): string {
  return `from:${quoteValue(address)}`;
}
