import { readFile } from "node:fs/promises";
import { buildRawMessage } from "../gmail/message.ts";

/** Options shared by the `send` and `drafts create` commands. */
export interface ComposeOptions {
  to: string;
  subject?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  body?: string;
  bodyFile?: string;
  html?: string;
  htmlFile?: string;
}

/**
 * Resolves the message body from explicit options, files, or stdin, and
 * returns a base64url RFC822 message ready for the Gmail API.
 */
export async function buildOutgoingRaw(opts: ComposeOptions): Promise<string> {
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
  return buildRawMessage({
    to: opts.to,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo,
    subject: opts.subject ?? "",
    body: body ?? "",
    html,
  });
}
