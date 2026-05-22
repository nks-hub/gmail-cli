# gmail-cli — Design Specification

**Date:** 2026-05-22
**Status:** Approved
**Repository:** `github.com/nks-hub/gmail-cli` (public, MIT)

## 1. Purpose

A fast, scriptable Gmail command-line client that compiles to standalone
single-file binaries. It replaces the Gmail MCP server with a tool that has
first-class JSON output, attachment support, and an interactive OAuth setup
wizard. Inspired by https://raf.dev/blog/gmail-cli/.

## 2. Technology

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Type safety, matches reference implementation ecosystem |
| Runtime / build | Bun `>=1.3` | Built-in test runner, `bun build --compile` cross-target binaries |
| CLI framework | `commander` | Mature subcommands and help generation |
| Gmail access | Hand-rolled OAuth2 PKCE + raw `fetch` | Zero Google SDK dependencies, fully unit-testable |
| Output | JSON / table / plain | `--json` is first-class for scripting |

## 3. Architecture

```
src/
  index.ts            CLI entry, command registration
  config.ts           Paths, API endpoints, OAuth scopes
  auth/
    store.ts          Credential + token persistence (~/.config/gmail-cli)
    oauth.ts          PKCE generation, loopback flow, token refresh
    wizard.ts         Interactive GCP project setup guide
  gmail/
    client.ts         Gmail REST API wrapper
    message.ts        MIME parsing and RFC822 building
    query.ts          Gmail search query helpers
  cli/
    output.ts         JSON / table / plain formatting
    commands/*.ts     One file per command group
tests/                bun test suites
.github/workflows/    ci.yml, release.yml
```

## 4. Authentication

- **Flow:** OAuth2 Installed-App flow with loopback redirect
  (`http://127.0.0.1:<ephemeral-port>`) and PKCE (S256).
- **Scopes:** `gmail.modify` and `gmail.send`. No full-mailbox scope; permanent
  delete is intentionally unsupported (trash only).
- **Storage:** `%APPDATA%\gmail-cli\` (Windows) or `$XDG_CONFIG_HOME` /
  `~/.config/gmail-cli/` (POSIX). Files: `credentials.json` (OAuth client),
  `token.json` (access + refresh tokens). POSIX file mode `0600`.
- **Repository carries zero secrets.** Credentials are always user-local and
  git-ignored.
- **Multi-account ready:** `--account <name>` selects `token-<name>.json`.

### Interactive wizard (`gmail auth setup`)

Walks the user step by step through: creating a Google Cloud project, enabling
the Gmail API, configuring the OAuth consent screen (External + test users),
creating a Desktop-app OAuth client, and importing the downloaded client JSON
or pasting the client ID/secret.

## 5. Commands

| Command | Function |
|---|---|
| `auth setup` | Interactive GCP + OAuth setup wizard |
| `auth login` / `logout` / `status` | Browser login, sign out, token state |
| `inbox` | List inbox messages |
| `search <query>` | Search with Gmail query syntax |
| `read <id>` / `batch-read <id...>` | Read one / fetch many in parallel |
| `send` | Compose and send (flags or stdin) |
| `labels list\|create\|delete\|rename` | Manage labels |
| `archive <id...>` | Remove messages from inbox (`batchModify`) |
| `modify <id...>` | `--read/--unread/--star/--trash/--spam/--add-label/--remove-label` |
| `drafts list\|create\|send\|delete` | Manage drafts |
| `threads <id>` | Read a full conversation thread |
| `attachments list\|download` | List and download attachments |
| `top-senders` | Analyse most frequent senders |

Global flags: `--json`, `--max-body-length <n>`, `--account <name>`.

## 6. Reliability

- `batchModify` is used for bulk label operations (up to 1000 ids per call).
- HTTP 429 / 5xx responses are retried with exponential backoff.
- Expired access tokens are refreshed transparently before each request.
- `top-senders` samples large inboxes to stay within API quota.

## 7. Testing

- `bun test`. Unit coverage for: query building, MIME parse/build, output
  formatters, PKCE generation, token store, argument parsing.
- The Gmail client is tested against a mocked `fetch`; no live API calls in CI.
- Manual integration testing against a dedicated test account.

## 8. CI/CD

- **`ci.yml`** (push / pull request): install, `bun test`, `tsc --noEmit`,
  smoke build.
- **`release.yml`** (tag `v*`): build `bun-windows-x64`, `bun-darwin-x64`,
  `bun-darwin-arm64`, `bun-linux-x64`, `bun-linux-arm64`; emit `SHA256SUMS`;
  publish a GitHub Release. An optional, condition-gated SignPath signing step
  is wired for Windows binaries once the project is accepted into the SignPath
  Foundation open-source program.

## 9. Security of Commitments

`.gitignore` excludes `credentials.json`, `token.json`, `client_secret*.json`,
`.env*`, build output and editor configs. No tokens or secrets ever enter CI or
the repository.
