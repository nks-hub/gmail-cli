import { Buffer } from "node:buffer";
import { openBrowser } from "../browser.ts";
import { OAUTH_AUTH_URL, OAUTH_TOKEN_URL, SCOPES } from "../config.ts";
import type { Credentials, Token } from "./store.ts";

/** Treat a token as expired this many milliseconds before its real expiry. */
const EXPIRY_SKEW_MS = 60_000;

/** Maximum time to wait for the user to complete the browser flow. */
const AUTH_TIMEOUT_MS = 300_000;

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** Returns a cryptographically random base64url string. */
export function randomString(byteLength = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

/** Generates a PKCE verifier and its S256 challenge. */
export async function generatePkce(): Promise<Pkce> {
  const verifier = randomString(32);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

/** Builds the Google authorization URL for the installed-app PKCE flow. */
export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
  scopes?: string[];
}): string {
  const url = new URL(OAUTH_AUTH_URL);
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (opts.scopes ?? SCOPES).join(" "));
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

/** Converts a raw Google token response into a persisted {@link Token}. */
export function tokenFromResponse(
  response: GoogleTokenResponse,
  previousRefreshToken?: string,
): Token {
  const refreshToken = response.refresh_token ?? previousRefreshToken;
  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Re-run `gmail auth login`.",
    );
  }
  return {
    accessToken: response.access_token,
    refreshToken,
    expiryDate: Date.now() + response.expires_in * 1000,
    scope: response.scope,
    tokenType: response.token_type,
  };
}

/** Returns true if the token is expired or about to expire. */
export function isExpired(token: Token, now: number = Date.now()): boolean {
  return now >= token.expiryDate - EXPIRY_SKEW_MS;
}

/** Exchanges an authorization code for a token set. */
export async function exchangeCode(opts: {
  creds: Credentials;
  code: string;
  verifier: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}): Promise<Token> {
  const body = new URLSearchParams({
    client_id: opts.creds.clientId,
    client_secret: opts.creds.clientSecret,
    code: opts.code,
    code_verifier: opts.verifier,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });
  const res = await (opts.fetchFn ?? fetch)(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  return tokenFromResponse((await res.json()) as GoogleTokenResponse);
}

/** Refreshes an access token using the stored refresh token. */
export async function refreshAccessToken(opts: {
  creds: Credentials;
  token: Token;
  fetchFn?: typeof fetch;
}): Promise<Token> {
  const body = new URLSearchParams({
    client_id: opts.creds.clientId,
    client_secret: opts.creds.clientSecret,
    refresh_token: opts.token.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await (opts.fetchFn ?? fetch)(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  }
  return tokenFromResponse(
    (await res.json()) as GoogleTokenResponse,
    opts.token.refreshToken,
  );
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

function htmlResponse(title: string, message: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
      `<body style="font-family:system-ui;text-align:center;padding-top:4rem">` +
      `<h2>${title}</h2><p>${message}</p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * Runs the full interactive OAuth flow: spins up a loopback HTTP server on an
 * ephemeral port, opens the browser, captures the redirect, and exchanges the
 * authorization code for a token set.
 */
export async function runLoopbackFlow(creds: Credentials): Promise<Token> {
  const { verifier, challenge } = await generatePkce();
  const state = randomString(16);

  let resolveCode!: (code: string) => void;
  let rejectCode!: (err: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/") {
        return new Response("Not found", { status: 404 });
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      if (error) {
        rejectCode(new Error(`Authorization denied: ${error}`));
        return htmlResponse("Authorization failed", "You can close this window.");
      }
      if (returnedState !== state) {
        rejectCode(new Error("OAuth state mismatch; aborting for safety."));
        return htmlResponse("Authorization failed", "State mismatch.");
      }
      if (!code) {
        rejectCode(new Error("No authorization code in redirect."));
        return htmlResponse("Authorization failed", "Missing code.");
      }
      resolveCode(code);
      return htmlResponse(
        "gmail-cli authorized",
        "Sign-in complete. You can close this window and return to the terminal.",
      );
    },
  });

  const redirectUri = `http://127.0.0.1:${server.port}`;
  const authUrl = buildAuthUrl({
    clientId: creds.clientId,
    redirectUri,
    challenge,
    state,
  });

  try {
    process.stderr.write(
      `\nOpening your browser for Google sign-in.\n` +
        `If it does not open automatically, visit this URL:\n\n${authUrl}\n\n`,
    );
    openBrowser(authUrl);
    const code = await Promise.race([
      codePromise,
      timeout(AUTH_TIMEOUT_MS, "Timed out waiting for browser authorization."),
    ]);
    return await exchangeCode({ creds, code, verifier, redirectUri });
  } finally {
    server.stop(true);
  }
}
