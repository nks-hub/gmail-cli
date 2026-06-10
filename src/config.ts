import { homedir } from "node:os";
import { join } from "node:path";

/** Application identity. */
export const APP_NAME = "gmail-cli";
export const BINARY_NAME = "gmail";
export const VERSION = "0.2.0";

/** Gmail REST API base URL. */
export const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

/** Google Calendar REST API base URL. */
export const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/** Google OAuth 2.0 endpoints. */
export const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * OAuth scopes requested by the tool. `gmail.modify` covers reading,
 * archiving, labelling, trashing and spam handling; `gmail.send` covers
 * sending; `calendar.events` covers reading and writing calendar events and
 * `calendar.calendarlist.readonly` covers listing the user's calendars.
 * The full-mailbox and full-calendar scopes are intentionally not requested,
 * so permanent mail deletion and calendar administration are unavailable by
 * design.
 */
export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

/**
 * Returns the per-user configuration directory where credentials and tokens
 * are stored. Honours `APPDATA` on Windows and `XDG_CONFIG_HOME` on POSIX.
 */
export function configDir(): string {
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(base, APP_NAME);
  }
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, APP_NAME);
}
