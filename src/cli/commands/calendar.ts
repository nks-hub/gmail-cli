import type { Command } from "commander";
import type {
  CalendarEvent,
  EventDateTime,
  EventReminder,
} from "../../calendar/client.ts";
import { color, emit, fail, renderTable } from "../output.ts";
import { getCalendarClient } from "../session.ts";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the system IANA time zone, e.g. `Europe/Prague`. */
function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Normalizes `YYYY-MM-DD HH:mm[:ss]` or RFC3339 input to RFC3339 local time. */
function normalizeDateTime(input: string): string {
  const normalized = input.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    throw new Error(
      `Invalid date-time "${input}". Use "YYYY-MM-DD HH:mm" or RFC3339.`,
    );
  }
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

/** Returns the `YYYY-MM-DD` string `days` days after the given date. */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Returns the RFC3339 local-time string `hours` hours after the given one. */
function addHours(dateTime: string, hours: number): string {
  const d = new Date(`${dateTime}Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 19);
}

/** Formats one event boundary for table output. */
function formatBoundary(boundary?: EventDateTime): string {
  if (!boundary) return "";
  if (boundary.date) return boundary.date;
  return (boundary.dateTime ?? "").replace("T", " ").slice(0, 16);
}

function eventRow(event: CalendarEvent): string[] {
  return [
    event.id ?? "",
    formatBoundary(event.start),
    event.summary ?? "(no title)",
  ];
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** Registers the `calendar` command group. */
export function registerCalendar(program: Command): void {
  const calendar = program
    .command("calendar")
    .description("List calendars and manage events");

  calendar
    .command("list")
    .description("List the calendars in the account")
    .action(async () => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getCalendarClient(account);
        const calendars = await client.listCalendars();
        emit(calendars, () =>
          renderTable(
            ["ID", "NAME", "ROLE"],
            calendars.map((entry) => [
              entry.id,
              entry.primary ? `${entry.summary} (primary)` : entry.summary,
              entry.accessRole ?? "",
            ]),
          ),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  calendar
    .command("events", { isDefault: true })
    .description("List upcoming events")
    .option("--calendar <id>", "calendar ID", "primary")
    .option("--from <date>", "start of range (YYYY-MM-DD, default today)")
    .option("--to <date>", "end of range (YYYY-MM-DD, exclusive)")
    .option("-q, --query <text>", "free-text search over events")
    .option("-n, --max <n>", "maximum number of events", "25")
    .action(
      async (opts: {
        calendar: string;
        from?: string;
        to?: string;
        query?: string;
        max: string;
      }) => {
        const { account } = program.opts<{ account?: string }>();
        try {
          for (const value of [opts.from, opts.to]) {
            if (value && !DATE_ONLY.test(value)) {
              throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
            }
          }
          const client = await getCalendarClient(account);
          const timeMin = opts.from
            ? `${opts.from}T00:00:00Z`
            : new Date().toISOString();
          const res = await client.listEvents(opts.calendar, {
            timeMin,
            timeMax: opts.to ? `${opts.to}T00:00:00Z` : undefined,
            query: opts.query,
            maxResults: Number(opts.max),
          });
          const events = res.items ?? [];
          emit(events, () =>
            events.length
              ? renderTable(["ID", "START", "SUMMARY"], events.map(eventRow))
              : "No events found.",
          );
        } catch (error) {
          fail((error as Error).message);
        }
      },
    );

  calendar
    .command("add")
    .description("Create an event")
    .argument("<summary...>", "event title")
    .option("--calendar <id>", "calendar ID", "primary")
    .option("--date <date>", "all-day event date (YYYY-MM-DD)")
    .option("--start <datetime>", 'start ("YYYY-MM-DD HH:mm" or RFC3339)')
    .option("--end <datetime>", "end (defaults to one hour after start)")
    .option("--description <text>", "event description")
    .option("--location <text>", "event location")
    .option(
      "--reminder <minutes>",
      "popup reminder N minutes before start (repeatable)",
      collect,
      [] as string[],
    )
    .action(
      async (
        summaryWords: string[],
        opts: {
          calendar: string;
          date?: string;
          start?: string;
          end?: string;
          description?: string;
          location?: string;
          reminder: string[];
        },
      ) => {
        const { account } = program.opts<{ account?: string }>();
        try {
          if (!opts.date && !opts.start) {
            throw new Error("Provide either --date or --start.");
          }
          if (opts.date && opts.start) {
            throw new Error("--date and --start are mutually exclusive.");
          }

          let start: EventDateTime;
          let end: EventDateTime;
          if (opts.date) {
            if (!DATE_ONLY.test(opts.date)) {
              throw new Error(`Invalid date "${opts.date}". Use YYYY-MM-DD.`);
            }
            start = { date: opts.date };
            end = { date: addDays(opts.date, 1) };
          } else {
            const timeZone = systemTimeZone();
            const startAt = normalizeDateTime(opts.start!);
            const endAt = opts.end
              ? normalizeDateTime(opts.end)
              : addHours(startAt, 1);
            start = { dateTime: startAt, timeZone };
            end = { dateTime: endAt, timeZone };
          }

          const overrides: EventReminder[] = opts.reminder.map((minutes) => {
            const parsed = Number(minutes);
            if (!Number.isInteger(parsed) || parsed < 0) {
              throw new Error(`Invalid reminder "${minutes}".`);
            }
            return { method: "popup", minutes: parsed };
          });

          const client = await getCalendarClient(account);
          const created = await client.createEvent(opts.calendar, {
            summary: summaryWords.join(" "),
            description: opts.description,
            location: opts.location,
            start,
            end,
            ...(overrides.length
              ? { reminders: { useDefault: false, overrides } }
              : {}),
          });
          emit(
            created,
            () =>
              `${color.green("Created event")} ${created.summary} ` +
              `(${created.id})\n${created.htmlLink ?? ""}`,
          );
        } catch (error) {
          fail((error as Error).message);
        }
      },
    );

  calendar
    .command("delete")
    .description("Delete an event")
    .argument("<eventId>", "event ID")
    .option("--calendar <id>", "calendar ID", "primary")
    .action(async (eventId: string, opts: { calendar: string }) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getCalendarClient(account);
        await client.deleteEvent(opts.calendar, eventId);
        emit(
          { status: "deleted", id: eventId },
          () => `${color.green("Deleted event")} ${eventId}.`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
