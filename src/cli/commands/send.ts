import type { Command } from "commander";
import type { ComposeOptions } from "../compose.ts";
import { buildOutgoingRaw } from "../compose.ts";
import {
  buildReplyHeaders,
  extractEmailAddress,
  formatFrom,
  pickSendAs,
  splitAddressList,
} from "../../gmail/message.ts";
import { color, emit, fail } from "../output.ts";
import { getClient } from "../session.ts";

interface ReplyOptions extends Omit<ComposeOptions, "to" | "subject"> {
  all?: boolean;
}

function addBodyOptions(command: Command): Command {
  return command
    .option("--body <text>", "plain-text body")
    .option("--body-file <path>", "read the plain-text body from a file")
    .option("--html <html>", "HTML body")
    .option("--html-file <path>", "read the HTML body from a file");
}

/** Registers the `send`, `reply` and `aliases` commands. */
export function registerSend(program: Command): void {
  addBodyOptions(
    program
      .command("send")
      .description("Compose and send a message")
      .requiredOption("--to <address>", "recipient address")
      .option("--from <address>", "send-as address (see `gmail aliases`)")
      .option("--subject <text>", "subject line", "")
      .option("--cc <address>", "carbon-copy address")
      .option("--bcc <address>", "blind carbon-copy address")
      .option("--reply-to <address>", "Reply-To address"),
  ).action(async (opts: ComposeOptions) => {
    const { account } = program.opts<{ account?: string }>();
    try {
      const client = await getClient(account);
      if (opts.from) {
        opts.from = formatFrom(pickSendAs(await client.listSendAs(), opts.from));
      }
      const sent = await client.sendMessage(await buildOutgoingRaw(opts));
      emit(
        { status: "sent", id: sent.id, threadId: sent.threadId },
        () => `${color.green("Sent")} (id ${sent.id}).`,
      );
    } catch (error) {
      fail((error as Error).message);
    }
  });

  addBodyOptions(
    program
      .command("reply <id>")
      .description("Reply to a message in its thread")
      .option("--all", "also reply to the original To and Cc recipients", false)
      .option(
        "--from <address>",
        "send-as address (default: the address the message was sent to)",
      )
      .option("--cc <address>", "additional carbon-copy address")
      .option("--bcc <address>", "blind carbon-copy address")
      .option("--reply-to <address>", "Reply-To address"),
  ).action(async (id: string, opts: ReplyOptions) => {
    const { account } = program.opts<{ account?: string }>();
    try {
      const client = await getClient(account);
      const original = await client.getMessage(id, {
        format: "metadata",
        metadataHeaders: [
          "From", "Reply-To", "To", "Cc", "Delivered-To",
          "Subject", "Message-ID", "References",
        ],
      });
      const headers = original.payload?.headers ?? [];
      const aliases = await client.listSendAs();
      const recipients = ["Delivered-To", "To", "Cc"]
        .flatMap((name) => headers.filter((h) => h.name.toLowerCase() === name.toLowerCase()))
        .flatMap((h) => splitAddressList(h.value))
        .map(extractEmailAddress);
      const alias = pickSendAs(aliases, opts.from, recipients);
      const reply = buildReplyHeaders(headers, {
        all: opts.all,
        self: aliases.map((a) => a.sendAsEmail),
      });
      const cc = [reply.cc, opts.cc].filter(Boolean).join(", ") || undefined;
      const raw = await buildOutgoingRaw(
        { ...opts, to: reply.to, subject: reply.subject, cc, from: formatFrom(alias) },
        { inReplyTo: reply.inReplyTo, references: reply.references },
      );
      const sent = await client.sendMessage(raw, original.threadId);
      emit(
        {
          status: "sent",
          id: sent.id,
          threadId: sent.threadId,
          from: alias.sendAsEmail,
          to: reply.to,
          cc: cc ?? "",
        },
        () =>
          `${color.green("Replied")} from ${alias.sendAsEmail} to ${reply.to} (id ${sent.id}, thread ${sent.threadId}).`,
      );
    } catch (error) {
      fail((error as Error).message);
    }
  });

  program
    .command("aliases")
    .description('List the "Send mail as" addresses usable with --from')
    .action(async () => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const aliases = await (await getClient(account)).listSendAs();
        emit(aliases, () =>
          aliases
            .map(
              (a) =>
                `${a.sendAsEmail}${a.displayName ? ` (${a.displayName})` : ""}` +
                `${a.isDefault ? " [default]" : ""}` +
                `${a.isPrimary || a.verificationStatus === "accepted" ? "" : " [unverified]"}`,
            )
            .join("\n"),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
