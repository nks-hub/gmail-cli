import type { Command } from "commander";
import { parseMessage } from "../../gmail/message.ts";
import { color, emit, fail } from "../output.ts";
import { renderMessage } from "../render.ts";
import { getClient } from "../session.ts";

/** Registers the `threads` command. */
export function registerThreads(program: Command): void {
  program
    .command("threads")
    .description("Read a full conversation thread")
    .argument("<id>", "thread ID")
    .action(async (id: string) => {
      const globals = program.opts<{ account?: string; maxBodyLength: string }>();
      try {
        const client = await getClient(globals.account);
        const thread = await client.getThread(id, { format: "full" });
        const messages = (thread.messages ?? []).map(parseMessage);
        emit({ id: thread.id, messages }, () =>
          messages
            .map((message) =>
              renderMessage(message, Number(globals.maxBodyLength)),
            )
            .join(`\n${color.dim("─".repeat(60))}\n`),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
