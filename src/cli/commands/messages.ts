import type { Command } from "commander";
import type { GmailClient } from "../../gmail/client.ts";
import { resolveLabelIds } from "../../gmail/labels.ts";
import { parseMessage } from "../../gmail/message.ts";
import { color, emit, fail } from "../output.ts";
import { renderMessage, renderMessageList } from "../render.ts";
import { getClient } from "../session.ts";

interface Globals {
  account?: string;
  maxBodyLength: string;
}

const METADATA_HEADERS = ["From", "To", "Cc", "Subject", "Date"];

async function fetchParsed(
  client: GmailClient,
  ids: string[],
  format: "full" | "metadata",
) {
  const messages = await Promise.all(
    ids.map((id) =>
      client.getMessage(id, {
        format,
        metadataHeaders: format === "metadata" ? METADATA_HEADERS : undefined,
      }),
    ),
  );
  return messages.map(parseMessage);
}

/** Registers the message-oriented commands. */
export function registerMessages(program: Command): void {
  program
    .command("inbox")
    .description("List messages in the inbox")
    .option("-n, --max <count>", "maximum number of messages", "20")
    .action(async (opts: { max: string }) => {
      const globals = program.opts<Globals>();
      try {
        const client = await getClient(globals.account);
        const list = await client.listMessages({
          labelIds: ["INBOX"],
          maxResults: Number(opts.max),
        });
        const refs = list.messages ?? [];
        const messages = await fetchParsed(
          client,
          refs.map((ref) => ref.id),
          "metadata",
        );
        emit(messages, () => renderMessageList(messages));
      } catch (error) {
        fail((error as Error).message);
      }
    });

  program
    .command("search")
    .description("Search messages using Gmail query syntax")
    .argument("<query...>", "Gmail search query, e.g. from:linkedin.com")
    .option("-n, --max <count>", "maximum number of messages", "25")
    .action(async (query: string[], opts: { max: string }) => {
      const globals = program.opts<Globals>();
      try {
        const client = await getClient(globals.account);
        const list = await client.listMessages({
          query: query.join(" "),
          maxResults: Number(opts.max),
        });
        const refs = list.messages ?? [];
        const messages = await fetchParsed(
          client,
          refs.map((ref) => ref.id),
          "metadata",
        );
        emit(messages, () => renderMessageList(messages));
      } catch (error) {
        fail((error as Error).message);
      }
    });

  program
    .command("read")
    .description("Read a single message")
    .argument("<id>", "message ID")
    .action(async (id: string) => {
      const globals = program.opts<Globals>();
      try {
        const client = await getClient(globals.account);
        const [message] = await fetchParsed(client, [id], "full");
        emit(message, () =>
          renderMessage(message!, Number(globals.maxBodyLength)),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  program
    .command("batch-read")
    .description("Read several messages in parallel")
    .argument("<ids...>", "message IDs")
    .action(async (ids: string[]) => {
      const globals = program.opts<Globals>();
      try {
        const client = await getClient(globals.account);
        const messages = await fetchParsed(client, ids, "full");
        emit(messages, () =>
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

  program
    .command("archive")
    .description("Remove messages from the inbox")
    .argument("<ids...>", "message IDs")
    .action(async (ids: string[]) => {
      const globals = program.opts<Globals>();
      try {
        const client = await getClient(globals.account);
        await client.batchModify(ids, { removeLabelIds: ["INBOX"] });
        emit(
          { status: "archived", count: ids.length },
          () => `${color.green("Archived")} ${ids.length} message(s).`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  program
    .command("modify")
    .description("Change message state and labels")
    .argument("<ids...>", "message IDs")
    .option("--read", "mark as read")
    .option("--unread", "mark as unread")
    .option("--star", "add a star")
    .option("--unstar", "remove the star")
    .option("--trash", "move to Trash")
    .option("--spam", "mark as spam")
    .option("--add-label <label...>", "labels to add (name or ID)")
    .option("--remove-label <label...>", "labels to remove (name or ID)")
    .action(
      async (
        ids: string[],
        opts: {
          read?: boolean;
          unread?: boolean;
          star?: boolean;
          unstar?: boolean;
          trash?: boolean;
          spam?: boolean;
          addLabel?: string[];
          removeLabel?: string[];
        },
      ) => {
        const globals = program.opts<Globals>();
        try {
          const client = await getClient(globals.account);
          const add: string[] = [];
          const remove: string[] = [];
          if (opts.read) remove.push("UNREAD");
          if (opts.unread) add.push("UNREAD");
          if (opts.star) add.push("STARRED");
          if (opts.unstar) remove.push("STARRED");
          if (opts.trash) add.push("TRASH");
          if (opts.spam) add.push("SPAM");
          if (opts.addLabel) {
            add.push(...(await resolveLabelIds(client, opts.addLabel)));
          }
          if (opts.removeLabel) {
            remove.push(...(await resolveLabelIds(client, opts.removeLabel)));
          }
          if (add.length === 0 && remove.length === 0) {
            fail("No modifications specified. See `gmail modify --help`.");
          }
          await client.batchModify(ids, {
            addLabelIds: add,
            removeLabelIds: remove,
          });
          emit(
            {
              status: "modified",
              count: ids.length,
              added: add,
              removed: remove,
            },
            () => `${color.green("Modified")} ${ids.length} message(s).`,
          );
        } catch (error) {
          fail((error as Error).message);
        }
      },
    );
}
