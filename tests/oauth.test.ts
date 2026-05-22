import { Buffer } from "node:buffer";
import { describe, expect, test } from "bun:test";
import {
  buildAuthUrl,
  exchangeCode,
  generatePkce,
  isExpired,
  refreshAccessToken,
  tokenFromResponse,
} from "../src/auth/oauth.ts";
import type { Token } from "../src/auth/store.ts";

function jsonFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

const creds = { clientId: "client-id", clientSecret: "client-secret" };

describe("generatePkce", () => {
  test("produces a verifier and a matching S256 challenge", async () => {
    const { verifier, challenge } = await generatePkce();
    expect(verifier.length).toBeGreaterThan(20);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    expect(challenge).toBe(
      Buffer.from(new Uint8Array(digest)).toString("base64url"),
    );
  });
});

describe("buildAuthUrl", () => {
  test("includes all required OAuth parameters", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "http://127.0.0.1:5000",
        challenge: "chal",
        state: "st",
      }),
    );
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });
});

describe("tokenFromResponse", () => {
  test("maps a Google token response", () => {
    const token = tokenFromResponse({
      access_token: "AT",
      expires_in: 3600,
      refresh_token: "RT",
      scope: "s",
      token_type: "Bearer",
    });
    expect(token.accessToken).toBe("AT");
    expect(token.refreshToken).toBe("RT");
    expect(token.expiryDate).toBeGreaterThan(Date.now());
  });

  test("falls back to the previous refresh token", () => {
    const token = tokenFromResponse(
      { access_token: "AT", expires_in: 60, scope: "s", token_type: "Bearer" },
      "OLD-RT",
    );
    expect(token.refreshToken).toBe("OLD-RT");
  });

  test("throws when no refresh token is available", () => {
    expect(() =>
      tokenFromResponse({
        access_token: "AT",
        expires_in: 60,
        scope: "s",
        token_type: "Bearer",
      }),
    ).toThrow();
  });
});

describe("isExpired", () => {
  const base: Token = {
    accessToken: "a",
    refreshToken: "r",
    expiryDate: 0,
    scope: "s",
    tokenType: "Bearer",
  };
  test("treats past tokens as expired", () => {
    expect(isExpired({ ...base, expiryDate: Date.now() - 1000 })).toBe(true);
  });
  test("treats tokens within the skew window as expired", () => {
    expect(isExpired({ ...base, expiryDate: Date.now() + 30_000 })).toBe(true);
  });
  test("treats fresh tokens as valid", () => {
    expect(isExpired({ ...base, expiryDate: Date.now() + 600_000 })).toBe(
      false,
    );
  });
});

describe("exchangeCode", () => {
  test("returns a token on success", async () => {
    const token = await exchangeCode({
      creds,
      code: "code",
      verifier: "verifier",
      redirectUri: "http://127.0.0.1:1",
      fetchFn: jsonFetch({
        access_token: "AT",
        expires_in: 3600,
        refresh_token: "RT",
        scope: "s",
        token_type: "Bearer",
      }),
    });
    expect(token.accessToken).toBe("AT");
  });

  test("throws on an error response", async () => {
    await expect(
      exchangeCode({
        creds,
        code: "bad",
        verifier: "v",
        redirectUri: "http://127.0.0.1:1",
        fetchFn: jsonFetch({ error: "invalid_grant" }, 400),
      }),
    ).rejects.toThrow();
  });
});

describe("refreshAccessToken", () => {
  test("preserves the refresh token when none is returned", async () => {
    const token = await refreshAccessToken({
      creds,
      token: {
        accessToken: "old",
        refreshToken: "KEEP-RT",
        expiryDate: 0,
        scope: "s",
        tokenType: "Bearer",
      },
      fetchFn: jsonFetch({
        access_token: "NEW",
        expires_in: 3600,
        scope: "s",
        token_type: "Bearer",
      }),
    });
    expect(token.accessToken).toBe("NEW");
    expect(token.refreshToken).toBe("KEEP-RT");
  });
});
