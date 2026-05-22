import type { Command } from "commander";
import { aggregateSenders } from "../../gmail/analyze.ts";
import type { GmailClient } from "../../gmail/client.ts";
import { getHeader } from "../../gmail/message.ts";
import { emit, fail, info, renderTable } from "../output.ts";
import { getClient } from "../session.ts";

/** Page size used when scanning the inbox. */
const PAGE_SIZE = 100;

/** Number of metadata requests issued in parallel. */
const FETCH_CONCURRENCY = 20;

async function collectMessageIds(
  client: GmailClient,
  limit: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await client.listMessages({
      labelIds: ["INBOX"],
      maxResults: Math.min(PAGE_SIZE, limit - ids.length),
      pageToken,
    });
    for (const ref of page.messages ?? []) ids.push(ref.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < limit);
  return ids.slice(0, limit);
}

async function fetchFromHeaders(
  client: GmailClient,
  ids: string[],
): Promise<string[]> {
  const headers: string[] = [];
  for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
    const batch = ids.slice(i, i + FETCH_CONCURRENCY);
    const messages = await Promise.all(
      batch.map((id) =>
        client.getMessage(id, {
          format: "metadata",
          metadataHeaders: ["From"],
        }),
      ),
    );
    for (const message of messages) {
      headers.push(getHeader(message.payload?.headers, "From"));
    }
  }
  return headers;
}

/** Registers the `top-senders` command. */
export function registerAnalyze(program: Command): void {
  program
    .command("top-senders")
    .description("Show which senders fill your inbox")
    .option("-t, --top <count>", "number of senders to show", "10")
    .option("-s, --scan <count>", "number of inbox messages to scan", "200")
    .action(async (opts: { top: string; scan: string }) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const ids = await collectMessageIds(client, Number(opts.scan));
        info(`Scanning ${ids.length} message(s)...`);
        const fromHeaders = await fetchFromHeaders(client, ids);
        const senders = aggregateSenders(fromHeaders, Number(opts.top));
        emit({ scanned: ids.length, senders }, () =>
          renderTable(
            ["COUNT", "SENDER"],
            senders.map((s) => [String(s.count), s.address]),
          ),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
