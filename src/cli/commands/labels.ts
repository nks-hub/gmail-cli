import type { Command } from "commander";
import { resolveLabelIds } from "../../gmail/labels.ts";
import { color, emit, fail, renderTable } from "../output.ts";
import { getClient } from "../session.ts";

/** Registers the `labels` command group. */
export function registerLabels(program: Command): void {
  const labels = program
    .command("labels")
    .description("List and manage labels");

  labels
    .command("list", { isDefault: true })
    .description("List all labels")
    .action(async () => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const all = await client.listLabels();
        emit(all, () =>
          renderTable(
            ["ID", "NAME", "TYPE"],
            all.map((label) => [label.id, label.name, label.type ?? ""]),
          ),
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  labels
    .command("create")
    .description("Create a new label")
    .argument("<name>", "label name")
    .action(async (name: string) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const created = await client.createLabel(name);
        emit(
          created,
          () => `${color.green("Created label")} ${created.name} (${created.id}).`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  labels
    .command("rename")
    .description("Rename a label")
    .argument("<label>", "existing label name or ID")
    .argument("<newName>", "new label name")
    .action(async (label: string, newName: string) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const [id] = await resolveLabelIds(client, [label]);
        const updated = await client.updateLabel(id!, newName);
        emit(
          updated,
          () => `${color.green("Renamed label")} to ${updated.name}.`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  labels
    .command("delete")
    .description("Delete a label")
    .argument("<label>", "label name or ID")
    .action(async (label: string) => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const client = await getClient(account);
        const [id] = await resolveLabelIds(client, [label]);
        await client.deleteLabel(id!);
        emit(
          { status: "deleted", id },
          () => `${color.green("Deleted label")} ${label}.`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
