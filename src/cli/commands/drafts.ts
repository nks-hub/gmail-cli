import type { Command } from "commander";
import { parseMessage } from "../../gmail/message.ts";
import type { ComposeOptions } from "../compose.ts";
import { buildOutgoingRaw } from "../compose.ts";
import { color, emit, fail, renderTable, truncate } from "../output.ts";
import { getClient } from "../session.ts";

/** Registers the `drafts` command group. */
export function registerDrafts(program: Command): void {
  const drafts = program
    .command("drafts")
    .description("List and manage drafts");

  drafts
    .command("list", { isDefault: true })
    .description("List drafts")
    .option("-n, --max <count>", "maximum number of drafts", "20")
    .action(async (opts: { max: string }) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const list = await client.listDrafts({ maxResults: Number(opts.max) });
        const entries = list.drafts ?? [];
        const detailed = await Promise.all(
          entries.map(async (draft) => {
            const message = draft.message
              ? parseMessage(
                  await client.getMessage(draft.message.id, {
                    format: "metadata",
                    metadataHeaders: ["To", "Subject"],
                  }),
                )
              : undefined;
            return {
              draftId: draft.id,
              to: message?.to ?? "",
              subject: message?.subject ?? "",
            };
          }),
        );
        emit(detailed, () =>
          renderTable(
            ["DRAFT ID", "TO", "SUBJECT"],
            detailed.map((d) => [
              d.draftId,
              truncate(d.to, 28),
              truncate(d.subject || "(no subject)", 46),
            ]),
          ),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  drafts
    .command("create")
    .description("Create a draft")
    .requiredOption("--to <address>", "recipient address")
    .option("--subject <text>", "subject line", "")
    .option("--cc <address>", "carbon-copy address")
    .option("--bcc <address>", "blind carbon-copy address")
    .option("--body <text>", "plain-text body")
    .option("--body-file <path>", "read the plain-text body from a file")
    .option("--html <html>", "HTML body")
    .option("--html-file <path>", "read the HTML body from a file")
    .action(async (opts: ComposeOptions) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const raw = await buildOutgoingRaw(opts);
        const client = await getClient(account);
        const draft = await client.createDraft(raw);
        emit(
          { status: "draft-created", id: draft.id },
          () => `${color.green("Draft created")} (id ${draft.id}).`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  drafts
    .command("send")
    .description("Send an existing draft")
    .argument("<id>", "draft ID")
    .action(async (id: string) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const sent = await client.sendDraft(id);
        emit(
          { status: "sent", id: sent.id },
          () => `${color.green("Sent draft")} (message id ${sent.id}).`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  drafts
    .command("delete")
    .description("Delete a draft")
    .argument("<id>", "draft ID")
    .action(async (id: string) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        await client.deleteDraft(id);
        emit(
          { status: "deleted", id },
          () => `${color.green("Deleted draft")} ${id}.`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
