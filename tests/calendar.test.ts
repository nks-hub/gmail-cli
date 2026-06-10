import { describe, expect, test } from "bun:test";
import { CalendarClient } from "../src/calendar/client.ts";

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

describe("CalendarClient.listCalendars", () => {
  test("returns the calendar list items", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      json({ items: [{ id: "primary", summary: "Me", primary: true }] }),
    );
    const client = new CalendarClient({ getAccessToken, fetchFn });
    const calendars = await client.listCalendars();
    expect(calendars).toHaveLength(1);
    expect(calendars[0]!.id).toBe("primary");
    expect(calls[0]!.url).toContain("/users/me/calendarList");
  });
});

describe("CalendarClient.listEvents", () => {
  test("sends the range and expansion parameters", async () => {
    const { fetchFn, calls } = recordingFetch(() => json({ items: [] }));
    const client = new CalendarClient({ getAccessToken, fetchFn });
    await client.listEvents("primary", {
      timeMin: "2026-06-01T00:00:00Z",
      maxResults: 10,
    });
    expect(calls[0]!.url).toContain("/calendars/primary/events");
    expect(calls[0]!.url).toContain("timeMin=2026-06-01T00%3A00%3A00Z");
    expect(calls[0]!.url).toContain("singleEvents=true");
    expect(calls[0]!.url).toContain("orderBy=startTime");
  });

  test("escapes the calendar ID", async () => {
    const { fetchFn, calls } = recordingFetch(() => json({ items: [] }));
    const client = new CalendarClient({ getAccessToken, fetchFn });
    await client.listEvents("team@group.calendar.google.com");
    expect(calls[0]!.url).toContain(
      "/calendars/team%40group.calendar.google.com/events",
    );
  });
});

describe("CalendarClient.createEvent", () => {
  test("posts the event body", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      json({ id: "evt1", summary: "Demo" }),
    );
    const client = new CalendarClient({ getAccessToken, fetchFn });
    const created = await client.createEvent("primary", {
      summary: "Demo",
      start: { date: "2026-06-14" },
      end: { date: "2026-06-15" },
    });
    expect(created.id).toBe("evt1");
    expect(calls[0]!.method).toBe("POST");
    const body = JSON.parse(calls[0]!.body!);
    expect(body.summary).toBe("Demo");
    expect(body.start.date).toBe("2026-06-14");
  });
});

describe("CalendarClient.patchEvent", () => {
  test("sends a PATCH with the partial body", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      json({ id: "evt1", summary: "Renamed" }),
    );
    const client = new CalendarClient({ getAccessToken, fetchFn });
    await client.patchEvent("primary", "evt1", { summary: "Renamed" });
    expect(calls[0]!.method).toBe("PATCH");
    expect(calls[0]!.url).toContain("/events/evt1");
  });
});

describe("CalendarClient.deleteEvent", () => {
  test("issues a DELETE and tolerates the empty response", async () => {
    const { fetchFn, calls } = recordingFetch(
      () => new Response(null, { status: 204 }),
    );
    const client = new CalendarClient({ getAccessToken, fetchFn });
    await client.deleteEvent("primary", "evt1");
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.url).toContain("/calendars/primary/events/evt1");
  });
});

describe("CalendarClient errors", () => {
  test("throws an ApiError with the HTTP status on failure", async () => {
    const { fetchFn } = recordingFetch(
      () => new Response("forbidden", { status: 403 }),
    );
    const client = new CalendarClient({ getAccessToken, fetchFn });
    await expect(client.getEvent("primary", "missing")).rejects.toThrow("403");
  });
});
