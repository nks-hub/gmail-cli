import type { ParsedMessage } from "../gmail/message.ts";
import { color, formatBytes, renderTable, truncate } from "./output.ts";

/** Crudely converts an HTML fragment to readable plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Returns the best available plain-text body for a message. */
export function bodyText(message: ParsedMessage): string {
  if (message.body.text) return message.body.text.trim();
  if (message.body.html) return htmlToText(message.body.html);
  return message.snippet;
}

/** Renders a list of messages as a compact table. */
export function renderMessageList(messages: ParsedMessage[]): string {
  if (messages.length === 0) return color.dim("No messages.");
  const rows = messages.map((message) => {
    const unread = message.labelIds.includes("UNREAD");
    const marker = unread ? color.cyan("●") : " ";
    return [
      message.id,
      truncate(message.from, 24),
      `${marker} ${truncate(message.subject || "(no subject)", 46)}`,
      truncate(message.date, 24),
    ];
  });
  return renderTable(["ID", "FROM", "SUBJECT", "DATE"], rows);
}

/** Renders a single message with headers and a (possibly truncated) body. */
export function renderMessage(
  message: ParsedMessage,
  maxBodyLength: number,
): string {
  const lines = [
    `${color.bold("From:")}    ${message.from}`,
    `${color.bold("To:")}      ${message.to}`,
  ];
  if (message.cc) lines.push(`${color.bold("Cc:")}      ${message.cc}`);
  lines.push(
    `${color.bold("Subject:")} ${message.subject || "(no subject)"}`,
    `${color.bold("Date:")}    ${message.date}`,
    `${color.bold("Labels:")}  ${message.labelIds.join(", ") || "-"}`,
  );
  if (message.attachments.length > 0) {
    const list = message.attachments
      .map((a) => `${a.filename} (${formatBytes(a.size)})`)
      .join(", ");
    lines.push(`${color.bold("Attach:")}  ${list}`);
  }
  const text = bodyText(message);
  const body =
    maxBodyLength > 0 && text.length > maxBodyLength
      ? `${text.slice(0, maxBodyLength)}\n${color.dim("[...truncated]")}`
      : text;
  lines.push("", body);
  return lines.join("\n");
}
