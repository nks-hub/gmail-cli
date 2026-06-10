/** An error carrying the HTTP status of a failed Google API call. */
export interface ApiError extends Error {
  status: number;
}

export type QueryValue = string | number | boolean | string[] | undefined;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const RETRYABLE_MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A thin, dependency-free wrapper over a Google REST API. All requests are
 * authorized through the injected access-token provider, and transient
 * failures (HTTP 429 and 5xx) are retried with exponential backoff.
 */
export class GoogleApiClient {
  readonly #getAccessToken: () => Promise<string>;
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;
  readonly #apiName: string;

  constructor(opts: {
    baseUrl: string;
    apiName: string;
    getAccessToken: () => Promise<string>;
    fetchFn?: typeof fetch;
  }) {
    this.#baseUrl = opts.baseUrl;
    this.#apiName = opts.apiName;
    this.#getAccessToken = opts.getAccessToken;
    this.#fetch = opts.fetchFn ?? fetch;
  }

  protected async request<T>(
    method: HttpMethod,
    path: string,
    opts: { query?: Record<string, QueryValue>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.#baseUrl + path);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${await this.#getAccessToken()}`,
    };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    let res: Response | undefined;
    for (let attempt = 1; attempt <= RETRYABLE_MAX_ATTEMPTS; attempt++) {
      res = await this.#fetch(url.toString(), { method, headers, body });
      if (res.status !== 429 && res.status < 500) break;
      if (attempt === RETRYABLE_MAX_ATTEMPTS) break;
      const backoff = Math.min(2 ** attempt * 250, 8000) + Math.random() * 250;
      await sleep(backoff);
    }
    if (!res) throw new Error("Request produced no response.");

    if (!res.ok) {
      const text = await res.text();
      const error = new Error(
        `${this.#apiName} ${method} ${path} failed (${res.status}): ${text}`,
      ) as ApiError;
      error.status = res.status;
      throw error;
    }

    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return undefined as T;
    return (await res.json()) as T;
  }
}
