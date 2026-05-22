import type { Command } from "commander";
import type { ComposeOptions } from "../compose.ts";
import { buildOutgoingRaw } from "../compose.ts";
import { color, emit, fail } from "../output.ts";
import { getClient } from "../session.ts";

/** Registers the `send` command. */
export function registerSend(program: Command): void {
  program
    .command("send")
    .description("Compose and send a message")
    .requiredOption("--to <address>", "recipient address")
    .option("--subject <text>", "subject line", "")
    .option("--cc <address>", "carbon-copy address")
    .option("--bcc <address>", "blind carbon-copy address")
    .option("--reply-to <address>", "Reply-To address")
    .option("--body <text>", "plain-text body")
    .option("--body-file <path>", "read the plain-text body from a file")
    .option("--html <html>", "HTML body")
    .option("--html-file <path>", "read the HTML body from a file")
    .action(async (opts: ComposeOptions) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const raw = await buildOutgoingRaw(opts);
        const client = await getClient(account);
        const sent = await client.sendMessage(raw);
        emit(
          { status: "sent", id: sent.id, threadId: sent.threadId },
          () => `${color.green("Sent")} (id ${sent.id}).`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
