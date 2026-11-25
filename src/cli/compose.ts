import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { buildRawMessage } from "../gmail/message.ts";
import type { OutgoingAttachment, OutgoingMessage } from "../gmail/message.ts";

/** Options shared by the `send`, `reply` and `drafts create` commands. */
export interface ComposeOptions {
  to?: string;
  from?: string;
  subject?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  body?: string;
  bodyFile?: string;
  html?: string;
  htmlFile?: string;
  attach?: string[];
}

/** Commander collector that lets `--attach` be repeated. */
export function collectPaths(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

/** Reads files to attach; the MIME type comes from the file extension. */
export async function readAttachments(paths: string[] = []): Promise<OutgoingAttachment[]> {
  return Promise.all(
    paths.map(async (path) => {
      let data: Buffer;
      try {
        data = await readFile(path);
      } catch (error) {
        throw new Error(`Cannot read attachment ${path}: ${(error as Error).message}`);
      }
      return { filename: basename(path), mimeType: Bun.file(path).type, data };
    }),
  );
}

/**
 * Resolves the message body from explicit options, files, or stdin, and
 * returns a base64url RFC822 message ready for the Gmail API.
 */
export async function buildOutgoingRaw(
  opts: ComposeOptions,
  threading: Pick<OutgoingMessage, "inReplyTo" | "references"> = {},
): Promise<string> {
  let body = opts.body;
  if (body === undefined && opts.bodyFile) {
    body = await readFile(opts.bodyFile, "utf8");
  }
  let html = opts.html;
  if (html === undefined && opts.htmlFile) {
    html = await readFile(opts.htmlFile, "utf8");
  }
  if (body === undefined && html === undefined) {
    if (process.stdin.isTTY) {
      throw new Error(
        "No message body. Pass --body, --body-file, or pipe text on stdin.",
      );
    }
    body = await Bun.stdin.text();
  }
  const attachments = await readAttachments(opts.attach);
  return buildRawMessage({
    to: opts.to,
    from: opts.from,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo,
    subject: opts.subject ?? "",
    body: body ?? "",
    html,
    attachments,
    ...threading,
  });
}
