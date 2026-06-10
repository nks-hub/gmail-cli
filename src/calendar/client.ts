import { CALENDAR_API_BASE } from "../config.ts";
import { GoogleApiClient } from "../google/api.ts";

/** A date or date-time boundary of an event. Exactly one field is set. */
export interface EventDateTime {
  /** All-day boundary as `YYYY-MM-DD`. */
  date?: string;
  /** Timed boundary as RFC3339, e.g. `2026-06-14T09:00:00+02:00`. */
  dateTime?: string;
  /** IANA time zone, e.g. `Europe/Prague`. */
  timeZone?: string;
}

export interface EventReminder {
  method: "popup" | "email";
  minutes: number;
}

export interface CalendarEvent {
  id?: string;
  status?: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: EventDateTime;
  end?: EventDateTime;
  created?: string;
  updated?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: EventReminder[];
  };
}

export interface ListEventsResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  accessRole?: string;
}

/**
 * A thin, dependency-free wrapper over the Google Calendar REST API, sharing
 * the auth and retry behaviour of {@link GoogleApiClient}.
 */
export class CalendarClient extends GoogleApiClient {
  constructor(opts: {
    getAccessToken: () => Promise<string>;
    fetchFn?: typeof fetch;
  }) {
    super({ baseUrl: CALENDAR_API_BASE, apiName: "Calendar API", ...opts });
  }

  /** Returns the user's calendar list. */
  async listCalendars(): Promise<CalendarListEntry[]> {
    const res = await this.request<{ items?: CalendarListEntry[] }>(
      "GET",
      "/users/me/calendarList",
    );
    return res.items ?? [];
  }

  /** Lists events of one calendar, expanded and ordered by start time. */
  listEvents(
    calendarId: string,
    opts: {
      timeMin?: string;
      timeMax?: string;
      query?: string;
      maxResults?: number;
      pageToken?: string;
    } = {},
  ): Promise<ListEventsResponse> {
    return this.request<ListEventsResponse>(
      "GET",
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        query: {
          timeMin: opts.timeMin,
          timeMax: opts.timeMax,
          q: opts.query,
          maxResults: opts.maxResults,
          pageToken: opts.pageToken,
          singleEvents: true,
          orderBy: "startTime",
        },
      },
    );
  }

  /** Fetches a single event. */
  getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      "GET",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    );
  }

  /** Creates an event. */
  createEvent(
    calendarId: string,
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      "POST",
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { body: event },
    );
  }

  /** Applies a partial update to an event. */
  patchEvent(
    calendarId: string,
    eventId: string,
    patch: CalendarEvent,
  ): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(
      "PATCH",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { body: patch },
    );
  }

  /** Deletes an event. */
  deleteEvent(calendarId: string, eventId: string): Promise<void> {
    return this.request<void>(
      "DELETE",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    );
  }
}
