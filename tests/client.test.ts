import { describe, expect, test } from "bun:test";
import { GmailClient } from "../src/gmail/client.ts";

interface RecordedCall {
  url: string;
  method: string;
  body: string | undefined;
}

function recordingFetch(
  responder: (call: RecordedCall) => Response,
): { fetchFn: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const call: RecordedCall = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    return responder(call);
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const getAccessToken = async () => "test-token";

describe("GmailClient.listMessages", () => {
  test("sends the query and returns the message list", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      json({ messages: [{ id: "1", threadId: "t1" }] }),
    );
    const client = new GmailClient({ getAccessToken, fetchFn });
    const result = await client.listMessages({
      query: "is:unread",
      maxResults: 5,
    });
    expect(result.messages).toHaveLength(1);
    expect(calls[0]!.url).toContain("q=is%3Aunread");
    expect(calls[0]!.url).toContain("maxResults=5");
  });
});

describe("GmailClient.getMessage", () => {
  test("requests the message by ID", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      json({ id: "abc", threadId: "t" }),
    );
    const client = new GmailClient({ getAccessToken, fetchFn });
    const message = await client.getMessage("abc", { format: "full" });
    expect(message.id).toBe("abc");
    expect(calls[0]!.url).toContain("/messages/abc");
    expect(calls[0]!.url).toContain("format=full");
  });
});

describe("GmailClient.batchModify", () => {
  test("splits more than 1000 IDs into separate calls", async () => {
    const { fetchFn, calls } = recordingFetch(
      () => new Response(null, { status: 204 }),
    );
    const client = new GmailClient({ getAccessToken, fetchFn });
    const ids = Array.from({ length: 2500 }, (_, i) => `id-${i}`);
    await client.batchModify(ids, { removeLabelIds: ["INBOX"] });
    expect(calls).toHaveLength(3);
    expect(calls[0]!.method).toBe("POST");
  });
});

describe("GmailClient retry behaviour", () => {
  test("retries once on HTTP 429 then succeeds", async () => {
    let attempts = 0;
    const { fetchFn, calls } = recordingFetch(() => {
      attempts++;
      return attempts === 1
        ? new Response("rate limited", { status: 429 })
        : json({ emailAddress: "me@example.com" });
    });
    const client = new GmailClient({ getAccessToken, fetchFn });
    const profile = await client.getProfile();
    expect(profile.emailAddress).toBe("me@example.com");
    expect(calls).toHaveLength(2);
  });

  test("throws an ApiError with the HTTP status on failure", async () => {
    const { fetchFn } = recordingFetch(
      () => new Response("not found", { status: 404 }),
    );
    const client = new GmailClient({ getAccessToken, fetchFn });
    await expect(client.getMessage("missing")).rejects.toThrow("404");
  });
});

describe("GmailClient.sendMessage", () => {
  test("posts the raw message body", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      json({ id: "sent-1", threadId: "t" }),
    );
    const client = new GmailClient({ getAccessToken, fetchFn });
    await client.sendMessage("cmF3LW1lc3NhZ2U");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toContain("/messages/send");
    expect(calls[0]!.body).toContain("cmF3LW1lc3NhZ2U");
  });
});
