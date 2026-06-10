import { isExpired, refreshAccessToken } from "../auth/oauth.ts";
import { loadCredentials, loadToken, saveToken } from "../auth/store.ts";
import { CalendarClient } from "../calendar/client.ts";
import { GmailClient } from "../gmail/client.ts";

/**
 * Builds an access-token provider for the given account that transparently
 * refreshes and persists the token whenever it is expired or about to expire.
 */
async function accessTokenProvider(
  account?: string,
): Promise<() => Promise<string>> {
  const credentials = await loadCredentials();
  let token = await loadToken(account);

  return async () => {
    if (isExpired(token)) {
      token = await refreshAccessToken({ creds: credentials, token });
      await saveToken(token, account);
    }
    return token.accessToken;
  };
}

/** Builds an authenticated {@link GmailClient} for the given account. */
export async function getClient(account?: string): Promise<GmailClient> {
  return new GmailClient({ getAccessToken: await accessTokenProvider(account) });
}

/** Builds an authenticated {@link CalendarClient} for the given account. */
export async function getCalendarClient(
  account?: string,
): Promise<CalendarClient> {
  return new CalendarClient({
    getAccessToken: await accessTokenProvider(account),
  });
}
