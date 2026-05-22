import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";

// Redirect the config directory to a throwaway location before importing the
// store, so tests never touch the real user profile.
const sandbox = mkdtempSync(join(tmpdir(), "gmail-cli-test-"));
process.env.APPDATA = sandbox;
process.env.XDG_CONFIG_HOME = sandbox;

const {
  clearToken,
  hasCredentials,
  hasToken,
  loadCredentials,
  loadToken,
  parseGoogleClientJson,
  saveCredentials,
  saveToken,
} = await import("../src/auth/store.ts");

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("parseGoogleClientJson", () => {
  test("parses the installed-app shape", () => {
    const creds = parseGoogleClientJson(
      JSON.stringify({
        installed: { client_id: "ID", client_secret: "SECRET" },
      }),
    );
    expect(creds).toEqual({ clientId: "ID", clientSecret: "SECRET" });
  });

  test("parses the web-app shape", () => {
    const creds = parseGoogleClientJson(
      JSON.stringify({ web: { client_id: "ID", client_secret: "SECRET" } }),
    );
    expect(creds.clientId).toBe("ID");
  });

  test("parses the flat shape", () => {
    const creds = parseGoogleClientJson(
      JSON.stringify({ clientId: "ID", clientSecret: "SECRET" }),
    );
    expect(creds.clientSecret).toBe("SECRET");
  });

  test("rejects invalid JSON", () => {
    expect(() => parseGoogleClientJson("not json")).toThrow();
  });

  test("rejects JSON missing the required fields", () => {
    expect(() => parseGoogleClientJson(JSON.stringify({ foo: "bar" }))).toThrow();
  });
});

describe("credentials persistence", () => {
  test("round-trips credentials through disk", async () => {
    expect(hasCredentials()).toBe(false);
    await saveCredentials({ clientId: "CID", clientSecret: "CSEC" });
    expect(hasCredentials()).toBe(true);
    expect(await loadCredentials()).toEqual({
      clientId: "CID",
      clientSecret: "CSEC",
    });
  });
});

describe("token persistence", () => {
  const token = {
    accessToken: "AT",
    refreshToken: "RT",
    expiryDate: 1_900_000_000_000,
    scope: "scope",
    tokenType: "Bearer",
  };

  test("saves, loads and clears a token", async () => {
    expect(hasToken()).toBe(false);
    await saveToken(token);
    expect(hasToken()).toBe(true);
    expect(await loadToken()).toEqual(token);
    await clearToken();
    expect(hasToken()).toBe(false);
  });

  test("keeps named accounts separate", async () => {
    await saveToken({ ...token, accessToken: "WORK" }, "work");
    expect(hasToken()).toBe(false);
    expect((await loadToken("work")).accessToken).toBe("WORK");
    await clearToken("work");
  });

  test("loadToken throws when not signed in", async () => {
    await expect(loadToken("missing")).rejects.toThrow();
  });
});
