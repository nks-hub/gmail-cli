import { isExpired, refreshAccessToken } from "../auth/oauth.ts";
import { loadCredentials, loadToken, saveToken } from "../auth/store.ts";
import { GmailClient } from "../gmail/client.ts";

/**
 * Builds an authenticated {@link GmailClient} for the given account. The
 * client transparently refreshes and persists the access token whenever it is
 * expired or about to expire.
 */
export async function getClient(account?: string): Promise<GmailClient> {
  const credentials = await loadCredentials();
  let token = await loadToken(account);

  return new GmailClient({
    getAccessToken: async () => {
      if (isExpired(token)) {
        token = await refreshAccessToken({ creds: credentials, token });
        await saveToken(token, account);
      }
      return token.accessToken;
    },
  });
}
