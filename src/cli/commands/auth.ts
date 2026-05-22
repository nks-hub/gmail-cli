import type { Command } from "commander";
import { runLoopbackFlow } from "../../auth/oauth.ts";
import {
  clearToken,
  hasToken,
  loadCredentials,
  loadToken,
  saveToken,
} from "../../auth/store.ts";
import { runSetupWizard } from "../../auth/wizard.ts";
import { color, emit, fail } from "../output.ts";
import { getClient } from "../session.ts";

/** Registers the `auth` command group. */
export function registerAuth(program: Command): void {
  const auth = program
    .command("auth")
    .description("Set up credentials and sign in to Google");

  auth
    .command("setup")
    .description("Interactive Google OAuth setup wizard")
    .action(async () => {
      try {
        await runSetupWizard();
      } catch (error) {
        fail((error as Error).message);
      }
    });

  auth
    .command("login")
    .description("Sign in to Google through the browser")
    .action(async () => {
      const { account } = program.opts<{ account?: string }>();
      try {
        const credentials = await loadCredentials();
        const token = await runLoopbackFlow(credentials);
        await saveToken(token, account);
        const profile = await (await getClient(account)).getProfile();
        emit(
          { status: "signed-in", account: profile.emailAddress },
          () => `${color.green("Signed in")} as ${profile.emailAddress}`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });

  auth
    .command("logout")
    .description("Remove the stored token for the current account")
    .action(async () => {
      const { account } = program.opts<{ account?: string }>();
      await clearToken(account);
      emit({ status: "signed-out" }, () => color.green("Signed out."));
    });

  auth
    .command("status")
    .description("Show the current authentication status")
    .action(async () => {
      const { account } = program.opts<{ account?: string }>();
      if (!hasToken(account)) {
        emit(
          { status: "signed-out" },
          () => "Not signed in. Run `gmail auth login`.",
        );
        return;
      }
      try {
        const token = await loadToken(account);
        const profile = await (await getClient(account)).getProfile();
        const expiresAt = new Date(token.expiryDate).toISOString();
        emit(
          {
            status: "signed-in",
            account: profile.emailAddress,
            messagesTotal: profile.messagesTotal,
            tokenExpiresAt: expiresAt,
            scope: token.scope,
          },
          () =>
            `${color.green("Signed in")} as ${profile.emailAddress}\n` +
            `Messages: ${profile.messagesTotal}\n` +
            `Token expires: ${expiresAt}`,
        );
      } catch (error) {
        fail((error as Error).message);
      }
    });
}
