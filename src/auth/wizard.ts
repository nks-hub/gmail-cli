import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { openBrowser } from "../browser.ts";
import { color } from "../cli/output.ts";
import { credentialsPath, parseGoogleClientJson, saveCredentials } from "./store.ts";

type Rl = ReturnType<typeof createInterface>;

const CONSOLE_LINKS = {
  createProject: "https://console.cloud.google.com/projectcreate",
  enableApi: "https://console.cloud.google.com/apis/library/gmail.googleapis.com",
  consentScreen: "https://console.cloud.google.com/auth/overview",
  credentials: "https://console.cloud.google.com/apis/credentials",
};

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

async function confirm(rl: Rl, question: string): Promise<boolean> {
  const answer = (await rl.question(`${question} ${color.dim("[Y/n]")} `)).trim();
  return answer === "" || /^y(es)?$/i.test(answer);
}

async function offerLink(rl: Rl, label: string, url: string): Promise<void> {
  console.log(`  ${color.cyan(url)}`);
  if (await confirm(rl, `  Open ${label} in your browser?`)) {
    openBrowser(url);
  }
}

function step(n: number, title: string): void {
  console.log(`\n${color.bold(`Step ${n}.`)} ${color.bold(title)}`);
}

/**
 * Runs the interactive OAuth setup wizard. It guides the user through creating
 * a Google Cloud project, enabling the Gmail API, configuring the OAuth
 * consent screen, and creating a Desktop-app OAuth client, then stores the
 * resulting credentials locally.
 */
export async function runSetupWizard(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(color.bold("\n=== gmail-cli setup wizard ===\n"));
    console.log(
      "This wizard helps you create the Google OAuth credentials that\n" +
        "gmail-cli needs. It takes about five minutes and uses your own\n" +
        "Google Cloud project, so your mailbox access stays under your\n" +
        "control. Nothing is sent anywhere except Google.\n",
    );
    await rl.question(color.dim("Press Enter to begin... "));

    step(1, "Create a Google Cloud project");
    console.log(
      "  Create a new project (or reuse an existing one). Any name works.",
    );
    await offerLink(rl, "the project creation page", CONSOLE_LINKS.createProject);
    await rl.question(color.dim("  Press Enter once the project is selected... "));

    step(2, "Enable the Gmail API");
    console.log("  On the next page, click ENABLE for the Gmail API.");
    await offerLink(rl, "the Gmail API page", CONSOLE_LINKS.enableApi);
    await rl.question(color.dim("  Press Enter once the API is enabled... "));

    step(3, "Configure the OAuth consent screen");
    console.log(
      "  Choose the EXTERNAL user type. Fill in the app name and your\n" +
        "  email, then add YOUR OWN Gmail address as a test user. While the\n" +
        "  app stays in Testing mode only test users can sign in, which is\n" +
        "  exactly what you want for a personal CLI.",
    );
    await offerLink(rl, "the consent screen settings", CONSOLE_LINKS.consentScreen);
    await rl.question(color.dim("  Press Enter once the consent screen is saved... "));

    step(4, "Create an OAuth client ID");
    console.log(
      "  Go to Credentials, click CREATE CREDENTIALS > OAuth client ID,\n" +
        `  and choose application type ${color.bold("Desktop app")}.\n` +
        "  After it is created, click DOWNLOAD JSON.",
    );
    await offerLink(rl, "the Credentials page", CONSOLE_LINKS.credentials);
    await rl.question(color.dim("  Press Enter once you have the client ID... "));

    step(5, "Import your credentials");
    console.log(
      "  Provide the downloaded JSON file, or paste the values manually.",
    );
    const jsonPath = stripQuotes(
      await rl.question(
        "  Path to the downloaded client_secret JSON (blank to paste manually): ",
      ),
    );

    let credentials;
    if (jsonPath !== "") {
      credentials = parseGoogleClientJson(await readFile(jsonPath, "utf8"));
    } else {
      const clientId = (await rl.question("  Client ID: ")).trim();
      const clientSecret = (await rl.question("  Client secret: ")).trim();
      if (clientId === "" || clientSecret === "") {
        throw new Error("Client ID and client secret are both required.");
      }
      credentials = { clientId, clientSecret };
    }

    await saveCredentials(credentials);
    console.log(
      `\n${color.green("Credentials saved")} to ${color.dim(credentialsPath())}`,
    );
    console.log(`\nNext, run ${color.bold("gmail auth login")} to sign in.\n`);
  } finally {
    rl.close();
  }
}
