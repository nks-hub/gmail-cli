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

/** A Gmail "Send mail as" identity (users.settings.sendAs). */
export interface SendAs {
  sendAsEmail: string;
  displayName?: string;
  isDefault?: boolean;
  isPrimary?: boolean;
  verificationStatus?: string;
}

/** Formats a send-as identity as a `From` header value. */
export function formatFrom(alias: SendAs): string {
  return alias.displayName
    ? `${encodeHeaderValue(alias.displayName)} <${alias.sendAsEmail}>`
    : alias.sendAsEmail;
}

/**
 * Picks the sending identity: the requested address, otherwise the alias the
 * original message was addressed to, otherwise the account default. Gmail
 * silently rewrites an unverified `From`, so unknown addresses are rejected.
 */
export function pickSendAs(
  aliases: SendAs[],
  requested?: string,
  recipients: string[] = [],
): SendAs {
  const usable = aliases.filter(
    (a) => a.isPrimary || a.verificationStatus === "accepted",
  );
  const byAddress = (address: string) =>
    usable.find((a) => a.sendAsEmail.toLowerCase() === address.toLowerCase());
  if (requested) {
    const match = byAddress(extractEmailAddress(requested));
    if (!match) {
      const known = usable.map((a) => a.sendAsEmail).join(", ");
      throw new Error(`${requested} is not a verified send-as address. Available: ${known}`);
    }
    return match;
  }
  for (const recipient of recipients) {
    const match = byAddress(recipient);
    if (match) return match;
  }
  const fallback = usable.find((a) => a.isDefault) ?? usable[0];
  if (!fallback) throw new Error("The account has no usable send-as address.");
  return fallback;
}

/** Splits an address-list header on commas outside quotes and angle brackets. */
export function splitAddressList(value: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  let angle = false;
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "<" && !quoted) angle = true;
    else if (ch === ">" && !quoted) angle = false;
    if (ch === "," && !quoted && !angle) {
      if (current.trim()) out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Recipient, subject and threading headers for a reply. */
export interface ReplyHeaders {
  to: string;
  cc?: string;
  subject: string;
  inReplyTo?: string;
  references?: string;
}

/**
 * Derives reply headers from the original message. With `all`, the original
 * To and Cc recipients go to Cc, minus the sender and the user's own
 * addresses (`self`).
 */
export function buildReplyHeaders(
  headers: GmailHeader[] | undefined,
  opts: { all?: boolean; self?: string[] } = {},
): ReplyHeaders {
  const to = getHeader(headers, "Reply-To") || getHeader(headers, "From");
  const subject = getHeader(headers, "Subject");
  const messageId = getHeader(headers, "Message-ID");
  const references = [getHeader(headers, "References"), messageId]
    .filter(Boolean)
    .join(" ");
  const reply: ReplyHeaders = {
    to,
    subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
    inReplyTo: messageId || undefined,
    references: references || undefined,
  };
  if (opts.all) {
    const skip = new Set(
      [...(opts.self ?? []), ...splitAddressList(to)].map(extractEmailAddress),
    );
    const cc = [getHeader(headers, "To"), getHeader(headers, "Cc")]
      .flatMap(splitAddressList)
      .filter((a) => {
        const address = extractEmailAddress(a);
        if (skip.has(address)) return false;
        skip.add(address);
        return true;
      });
    if (cc.length) reply.cc = cc.join(", ");
  }
  return reply;
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
