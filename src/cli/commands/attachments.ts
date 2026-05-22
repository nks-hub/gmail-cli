import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Command } from "commander";
import type { Attachment } from "../../gmail/message.ts";
import { parseMessage } from "../../gmail/message.ts";
import { color, emit, fail, formatBytes, renderTable } from "../output.ts";
import { getClient } from "../session.ts";

/** Removes path components and unusual characters from an attachment name. */
function safeFilename(name: string): string {
  const base = basename(name).replace(/[^\w.\- ]/g, "_").trim();
  return base === "" ? "attachment" : base;
}

/** Registers the `attachments` command group. */
export function registerAttachments(program: Command): void {
  const attachments = program
    .command("attachments")
    .description("List and download message attachments");

  attachments
    .command("list")
    .description("List the attachments of a message")
    .argument("<messageId>", "message ID")
    .action(async (messageId: string) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const message = parseMessage(
          await client.getMessage(messageId, { format: "full" }),
        );
        emit(message.attachments, () =>
          message.attachments.length === 0
            ? color.dim("No attachments.")
            : renderTable(
                ["ATTACHMENT ID", "FILENAME", "TYPE", "SIZE"],
                message.attachments.map((a) => [
                  a.id,
                  a.filename,
                  a.mimeType,
                  formatBytes(a.size),
                ]),
              ),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  attachments
    .command("download")
    .description("Download one or all attachments of a message")
    .argument("<messageId>", "message ID")
    .argument("[attachmentId]", "attachment ID (omit to download all)")
    .option("-o, --out <dir>", "output directory", ".")
    .action(
      async (
        messageId: string,
        attachmentId: string | undefined,
        opts: { out: string },
      ) => {
        const { account } = program.opts<{ account?: string }>();
        try {
          const client = await getClient(account);
          const message = parseMessage(
            await client.getMessage(messageId, { format: "full" }),
          );
          let targets: Attachment[] = message.attachments;
          if (attachmentId) {
            targets = targets.filter((a) => a.id === attachmentId);
            if (targets.length === 0) {
              fail(`No attachment with ID ${attachmentId} on that message.`);
            }
          }
          if (targets.length === 0) {
            fail("That message has no attachments.");
          }
          await mkdir(opts.out, { recursive: true });
          const saved: Array<{ filename: string; path: string; size: number }> =
            [];
          for (const target of targets) {
            const data = await client.getAttachment(messageId, target.id);
            const path = join(opts.out, safeFilename(target.filename));
            await writeFile(path, Buffer.from(data.data, "base64url"));
            saved.push({ filename: target.filename, path, size: data.size });
          }
          emit(
            { status: "downloaded", files: saved },
            () =>
              `${color.green("Downloaded")} ${saved.length} file(s):\n` +
              saved
                .map((f) => `  ${f.path} (${formatBytes(f.size)})`)
                .join("\n"),
          );
        } catch (error) {
          fail((error as Error).message);
        }
      },
    );
}
