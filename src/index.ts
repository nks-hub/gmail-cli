#!/usr/bin/env bun
import { Command } from "commander";
import { registerAnalyze } from "./cli/commands/analyze.ts";
import { registerAttachments } from "./cli/commands/attachments.ts";
import { registerAuth } from "./cli/commands/auth.ts";
import { registerDrafts } from "./cli/commands/drafts.ts";
import { registerLabels } from "./cli/commands/labels.ts";
import { registerMessages } from "./cli/commands/messages.ts";
import { registerSend } from "./cli/commands/send.ts";
import { registerThreads } from "./cli/commands/threads.ts";
import { setJsonMode } from "./cli/output.ts";
import { VERSION } from "./config.ts";

const program = new Command();

program
  .name("gmail")
  .description("A fast, scriptable Gmail command-line client.")
  .version(VERSION, "-v, --version", "show the version and exit")
  .option("--json", "output structured JSON", false)
  .option("--account <name>", "use a named account profile")
  .option(
    "--max-body-length <n>",
    "truncate message bodies to N characters (0 = unlimited)",
    "2000",
  )
  .showHelpAfterError()
  .hook("preAction", () => {
    setJsonMode(Boolean(program.opts().json));
  });

registerAuth(program);
registerMessages(program);
registerSend(program);
registerLabels(program);
registerDrafts(program);
registerThreads(program);
registerAttachments(program);
registerAnalyze(program);

program.addHelpText(
  "after",
  "\nGlobal options such as --json must be given before the command,\n" +
    "e.g. `gmail --json inbox`. Run `gmail auth setup` to get started.",
);

if (process.argv.length <= 2) {
  program.help();
}

program.parseAsync(process.argv).catch((error: unknown) => {
  process.stderr.write(`Error: ${(error as Error).message}\n`);
  process.exit(1);
});
