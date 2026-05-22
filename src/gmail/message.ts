import { Buffer } from "node:buffer";

/** A raw RFC822 header as returned by the Gmail API. */
export interface GmailHeader {
  name: string;
  value: string;
}

/** The `body` field of a Gmail MIME part. */
export interface GmailBody {
  data?: string;
  attachmentId?: string;
  size?: number;
}

/** A node in the Gmail MIME tree. */
export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailBody;
  parts?: GmailPart[];
}

/** A Gmail message resource (format=full). */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

/** A file attached to a message. */
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** A message normalized into a flat, script-friendly shape. */
export interface ParsedMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: { text?: string; html?: string };
  attachments: Attachment[];
}

/** A message to be composed and sent. */
export interface OutgoingMessage {
  to: string;
  from?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  body: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
}

/** Decodes Gmail's base64url-encoded body data to a UTF-8 string. */
export function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/** Encodes a UTF-8 string to base64url. */
export function encodeBase64Url(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

/** Returns the value of a header by name (case-insensitive), or "". */
export function getHeader(
  headers: GmailHeader[] | undefined,
  name: string,
): string {
  const lower = name.toLowerCase();
  return headers?.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
}

/** Extracts the bare email address from a `Name <addr>` header value. */
export function extractEmailAddress(headerValue: string): string {
  const angle = headerValue.match(/<([^>]+)>/);
  return (angle ? angle[1]! : headerValue).trim().toLowerCase();
}

interface BodyAccumulator {
  text?: string;
  html?: string;
  attachments: Attachment[];
}

function walkParts(part: GmailPart | undefined, acc: BodyAccumulator): void {
  if (!part) return;
  const mime = part.mimeType ?? "";
  if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({
      id: part.body.attachmentId,
      filename: part.filename,
      mimeType: mime,
      size: part.body.size ?? 0,
    });
  } else if (mime === "text/plain" && part.body?.data && acc.text === undefined) {
    acc.text = decodeBase64Url(part.body.data);
  } else if (mime === "text/html" && part.body?.data && acc.html === undefined) {
    acc.html = decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    walkParts(child, acc);
  }
}

/** Normalizes a raw Gmail message into a {@link ParsedMessage}. */
export function parseMessage(message: GmailMessage): ParsedMessage {
  const headers = message.payload?.headers;
  const acc: BodyAccumulator = { attachments: [] };
  walkParts(message.payload, acc);
  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds ?? [],
    snippet: message.snippet ?? "",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    body: { text: acc.text, html: acc.html },
    attachments: acc.attachments,
  };
}

function hasNonAscii(value: string): boolean {
  return /[^\x00-\x7F]/.test(value);
}

/** Encodes a header value as an RFC 2047 encoded-word when it is non-ASCII. */
export function encodeHeaderValue(value: string): string {
  if (!hasNonAscii(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function chunkBase64(base64: string): string {
  return (base64.match(/.{1,76}/g) ?? []).join("\r\n");
}

/**
 * Builds an RFC822 message and returns it base64url-encoded, ready for the
 * Gmail `messages.send` endpoint. When `html` is supplied, a
 * `multipart/alternative` body is produced.
 */
export function buildRawMessage(message: OutgoingMessage): string {
  const headers: string[] = [`To: ${message.to}`];
  if (message.from) headers.push(`From: ${message.from}`);
  if (message.cc) headers.push(`Cc: ${message.cc}`);
  if (message.bcc) headers.push(`Bcc: ${message.bcc}`);
  if (message.replyTo) headers.push(`Reply-To: ${message.replyTo}`);
  if (message.inReplyTo) headers.push(`In-Reply-To: ${message.inReplyTo}`);
  if (message.references) headers.push(`References: ${message.references}`);
  headers.push(`Subject: ${encodeHeaderValue(message.subject)}`);
  headers.push("MIME-Version: 1.0");

  const textB64 = chunkBase64(Buffer.from(message.body, "utf8").toString("base64"));
  let raw: string;

  if (message.html) {
    const boundary = `bnd_${crypto.randomUUID()}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const htmlB64 = chunkBase64(
      Buffer.from(message.html, "utf8").toString("base64"),
    );
    const parts = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      textB64,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      htmlB64,
      `--${boundary}--`,
    ];
    raw = `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push("Content-Transfer-Encoding: base64");
    raw = `${headers.join("\r\n")}\r\n\r\n${textB64}`;
  }

  return Buffer.from(raw, "utf8").toString("base64url");
}
