/** Output mode shared across all commands. */
let jsonMode = false;

/** Enables or disables JSON output mode. */
export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

/** Returns true when JSON output mode is active. */
export function isJsonMode(): boolean {
  return jsonMode;
}

const useColor =
  Boolean(process.stdout.isTTY) &&
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb";

function paint(code: string): (text: string) => string {
  return (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
}

/** ANSI colour helpers that degrade to plain text when colour is unavailable. */
export const color = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("34"),
  cyan: paint("36"),
};

/** Truncates text to `max` characters, appending an ellipsis when cut. */
export function truncate(text: string, max: number): string {
  if (max <= 0 || text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Formats a byte count as a human-readable size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Renders a fixed-width text table. */
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const line = (cells: string[]): string =>
    cells.map((cell, i) => (cell ?? "").padEnd(widths[i]!)).join("  ").trimEnd();
  const out = [color.bold(line(headers))];
  for (const row of rows) out.push(line(row));
  return out.join("\n");
}

/**
 * Emits a result. In JSON mode the structured payload is printed; otherwise
 * the lazily-built human-readable string is used.
 */
export function emit(jsonData: unknown, human: () => string): void {
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(jsonData, null, 2)}\n`);
  } else {
    process.stdout.write(`${human()}\n`);
  }
}

/** Emits raw structured JSON regardless of mode. */
export function emitJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

/** Writes an informational message to stderr (suppressed in JSON mode). */
export function info(message: string): void {
  if (!jsonMode) process.stderr.write(`${message}\n`);
}

/** Prints an error and exits with a non-zero status. */
export function fail(message: string): never {
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
  } else {
    process.stderr.write(`${color.red("Error:")} ${message}\n`);
  }
  process.exit(1);
}
