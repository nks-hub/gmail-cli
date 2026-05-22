import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { configDir } from "../config.ts";

/** OAuth client credentials for a Desktop / Installed application. */
export interface Credentials {
  clientId: string;
  clientSecret: string;
}

/** A persisted OAuth token set. */
export interface Token {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry time in epoch milliseconds. */
  expiryDate: number;
  scope: string;
  tokenType: string;
}

/** Absolute path of the OAuth client credentials file. */
export function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

/** Absolute path of the token file for the given account (default account). */
export function tokenPath(account?: string): string {
  const name = account ? `token-${account}.json` : "token.json";
  return join(configDir(), name);
}

async function writeSecure(path: string, data: unknown): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
  // Best effort on POSIX; chmod is effectively a no-op on Windows.
  try {
    await chmod(path, 0o600);
  } catch {
    // Ignore: not all filesystems support POSIX permissions.
  }
}

/**
 * Parses a Google Cloud OAuth client JSON file (the `client_secret*.json`
 * download) into normalized credentials. Accepts both `installed` and `web`
 * client shapes, as well as the tool's own flat `{ clientId, clientSecret }`.
 */
export function parseGoogleClientJson(raw: string): Credentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Credentials file is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Credentials file has an unexpected structure.");
  }
  const obj = parsed as Record<string, unknown>;
  const block = (obj.installed ?? obj.web ?? obj) as Record<string, unknown>;
  const clientId = block.client_id ?? obj.clientId;
  const clientSecret = block.client_secret ?? obj.clientSecret;
  if (typeof clientId !== "string" || typeof clientSecret !== "string") {
    throw new Error(
      "Credentials file is missing client_id or client_secret.",
    );
  }
  return { clientId, clientSecret };
}

/** Persists OAuth client credentials to the config directory. */
export async function saveCredentials(creds: Credentials): Promise<void> {
  await writeSecure(credentialsPath(), creds);
}

/** Returns true if OAuth client credentials have been configured. */
export function hasCredentials(): boolean {
  return existsSync(credentialsPath());
}

/** Loads OAuth client credentials, or throws if none are configured. */
export async function loadCredentials(): Promise<Credentials> {
  if (!hasCredentials()) {
    throw new Error(
      "No credentials configured. Run `gmail auth setup` first.",
    );
  }
  return parseGoogleClientJson(await readFile(credentialsPath(), "utf8"));
}

/** Persists a token set for the given account. */
export async function saveToken(
  token: Token,
  account?: string,
): Promise<void> {
  await writeSecure(tokenPath(account), token);
}

/** Returns true if a token exists for the given account. */
export function hasToken(account?: string): boolean {
  return existsSync(tokenPath(account));
}

/** Loads a token set for the given account, or throws if not signed in. */
export async function loadToken(account?: string): Promise<Token> {
  if (!hasToken(account)) {
    throw new Error("Not signed in. Run `gmail auth login` first.");
  }
  return JSON.parse(await readFile(tokenPath(account), "utf8")) as Token;
}

/** Removes the stored token for the given account, if present. */
export async function clearToken(account?: string): Promise<void> {
  if (hasToken(account)) {
    await unlink(tokenPath(account));
  }
}
