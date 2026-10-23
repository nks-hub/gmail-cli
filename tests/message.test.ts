import { Buffer } from "node:buffer";
import { describe, expect, test } from "bun:test";
import {
  buildRawMessage,
  buildReplyHeaders,
  decodeBase64Url,
  encodeBase64Url,
  encodeHeaderValue,
  extractEmailAddress,
  formatFrom,
  getHeader,
  parseMessage,
  pickSendAs,
  splitAddressList,
} from "../src/gmail/message.ts";
import type { GmailMessage, SendAs } from "../src/gmail/message.ts";

const b64url = (text: string) => Buffer.from(text, "utf8").toString("base64url");

describe("base64url helpers", () => {
  test("round-trips text", () => {
    expect(decodeBase64Url(encodeBase64Url("héllo"))).toBe("héllo");
  });
});

describe("getHeader", () => {
  const headers = [{ name: "From", value: "a@b.com" }];
  test("matches case-insensitively", () => {
    expect(getHeader(headers, "from")).toBe("a@b.com");
  });
  test("returns empty string when absent", () => {
    expect(getHeader(headers, "Subject")).toBe("");
  });
});

describe("extractEmailAddress", () => {
  test("extracts from a display-name header", () => {
    expect(extractEmailAddress("Alice <alice@example.com>")).toBe(
      "alice@example.com",
    );
  });
  test("handles a bare address", () => {
    expect(extractEmailAddress("BOB@Example.com")).toBe("bob@example.com");
  });
});

describe("parseMessage", () => {
  const sample: GmailMessage = {
    id: "m1",
    threadId: "t1",
    labelIds: ["INBOX", "UNREAD"],
    snippet: "snippet text",
    payload: {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: "Alice <alice@example.com>" },
        { name: "To", value: "bob@example.com" },
        { name: "Subject", value: "Hello" },
        { name: "Date", value: "Mon, 1 Jan 2026 10:00:00 +0000" },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: b64url("plain body") } },
        { mimeType: "text/html", body: { data: b64url("<p>html body</p>") } },
        {
          mimeType: "application/pdf",
          filename: "doc.pdf",
          body: { attachmentId: "att1", size: 2048 },
        },
      ],
    },
  };

  test("extracts headers, body and attachments", () => {
    const parsed = parseMessage(sample);
    expect(parsed.from).toBe("Alice <alice@example.com>");
    expect(parsed.subject).toBe("Hello");
    expect(parsed.body.text).toBe("plain body");
    expect(parsed.body.html).toBe("<p>html body</p>");
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toEqual({
      id: "att1",
      filename: "doc.pdf",
      mimeType: "application/pdf",
      size: 2048,
    });
  });

  test("tolerates a missing payload", () => {
    const parsed = parseMessage({ id: "x", threadId: "y" });
    expect(parsed.subject).toBe("");
    expect(parsed.attachments).toEqual([]);
  });
});

describe("encodeHeaderValue", () => {
  test("passes ASCII through unchanged", () => {
    expect(encodeHeaderValue("Plain Subject")).toBe("Plain Subject");
  });
  test("encodes non-ASCII as an RFC 2047 word", () => {
    expect(encodeHeaderValue("Příliš")).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });
});

describe("splitAddressList", () => {
  test("keeps commas inside quoted display names", () => {
    expect(splitAddressList('"Doe, John" <j@x.com>, b@y.com')).toEqual([
      '"Doe, John" <j@x.com>',
      "b@y.com",
    ]);
  });
});

describe("pickSendAs", () => {
  const aliases: SendAs[] = [
    { sendAsEmail: "me@gmail.com", isPrimary: true, isDefault: true },
    { sendAsEmail: "dev@corp.cz", displayName: "Dev", verificationStatus: "accepted" },
    { sendAsEmail: "pending@corp.cz", verificationStatus: "pending" },
  ];
  test("honours an explicit address in any case", () => {
    expect(pickSendAs(aliases, "DEV@corp.cz").sendAsEmail).toBe("dev@corp.cz");
  });
  test("rejects an unverified or unknown address", () => {
    expect(() => pickSendAs(aliases, "pending@corp.cz")).toThrow("not a verified");
    expect(() => pickSendAs(aliases, "nobody@x.com")).toThrow("Available: me@gmail.com, dev@corp.cz");
  });
  test("defaults to the alias the original was addressed to", () => {
    expect(pickSendAs(aliases, undefined, ["other@x.com", "dev@corp.cz"]).sendAsEmail).toBe("dev@corp.cz");
  });
  test("falls back to the default identity", () => {
    expect(pickSendAs(aliases, undefined, ["other@x.com"]).sendAsEmail).toBe("me@gmail.com");
  });
  test("formats the display name into the From header", () => {
    expect(formatFrom(aliases[1]!)).toBe("Dev <dev@corp.cz>");
  });
});

describe("buildReplyHeaders", () => {
  const headers = [
    { name: "From", value: "Matt <matt@ext.com>" },
    { name: "To", value: '"dev@corp.cz" <dev@corp.cz>, ann@ext.com' },
    { name: "Cc", value: "me@gmail.com, matt@ext.com" },
    { name: "Subject", value: "Permissions Errors" },
    { name: "Message-Id", value: "<abc@ext.com>" },
    { name: "References", value: "<root@ext.com>" },
  ];
  test("threads the reply to the sender", () => {
    expect(buildReplyHeaders(headers)).toEqual({
      to: "Matt <matt@ext.com>",
      subject: "Re: Permissions Errors",
      inReplyTo: "<abc@ext.com>",
      references: "<root@ext.com> <abc@ext.com>",
    });
  });
  test("prefers Reply-To and keeps an existing Re: prefix", () => {
    const reply = buildReplyHeaders([
      ...headers.filter((h) => h.name !== "Subject"),
      { name: "Reply-To", value: "list@ext.com" },
      { name: "Subject", value: "RE: Permissions Errors" },
    ]);
    expect(reply.to).toBe("list@ext.com");
    expect(reply.subject).toBe("RE: Permissions Errors");
  });
  test("reply-all copies other recipients without self or the sender", () => {
    const reply = buildReplyHeaders(headers, { all: true, self: ["dev@corp.cz", "me@gmail.com"] });
    expect(reply.cc).toBe("ann@ext.com");
  });
});

describe("buildRawMessage", () => {
  test("writes From and threading headers", () => {
    const raw = buildRawMessage({
      to: "a@b.com",
      from: "Dev <dev@corp.cz>",
      subject: "Re: Hi",
      body: "x",
      inReplyTo: "<abc@ext.com>",
      references: "<abc@ext.com>",
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("From: Dev <dev@corp.cz>");
    expect(decoded).toContain("In-Reply-To: <abc@ext.com>");
    expect(decoded).toContain("References: <abc@ext.com>");
  });

  test("builds a plain-text message", () => {
    const raw = buildRawMessage({
      to: "a@b.com",
      subject: "Hi",
      body: "Body text",
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: a@b.com");
    expect(decoded).toContain("Subject: Hi");
    expect(decoded).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(decoded).toContain(
      Buffer.from("Body text", "utf8").toString("base64"),
    );
  });

  test("builds a multipart/alternative message when HTML is given", () => {
    const raw = buildRawMessage({
      to: "a@b.com",
      subject: "Hi",
      body: "text",
      html: "<b>html</b>",
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("multipart/alternative");
    expect(decoded).toContain("text/html");
  });
});
