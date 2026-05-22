# gmail-cli

[![CI](https://github.com/nks-hub/gmail-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/nks-hub/gmail-cli/actions)
[![Release](https://img.shields.io/github/v/release/nks-hub/gmail-cli.svg)](https://github.com/nks-hub/gmail-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3+-f9f1e1.svg)](https://bun.sh/)

> A fast, scriptable Gmail command-line client — read, search, send, and organize Gmail from the terminal, scripts, or an AI assistant, with first-class JSON output.

---

## Why?

Instead of clicking through the Gmail web UI — or fighting an MCP server that
cannot download an attachment — drive your inbox directly:

- "List my unread inbox as JSON and pull out the subjects"
- "Search `from:linkedin.com before:2025/06/01` and archive all of it"
- "Download every attachment from this message"
- "Send a release notification from a CI pipeline"
- "Show me which senders fill my inbox"

It ships as a single standalone binary, so it works the same on a laptop, a
server, or inside an automation.

---

## Quick Start

### Installation

#### Install script

**macOS / Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/nks-hub/gmail-cli/main/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/nks-hub/gmail-cli/main/install.ps1 | iex
```

The script downloads the correct binary for your platform from the latest
release, verifies its SHA-256 checksum, installs it to a per-user directory,
and adds that directory to your `PATH`. Override the location with the
`GMAIL_CLI_INSTALL_DIR` environment variable, then restart your terminal.

#### Download manually

Grab the binary for your platform from the
[Releases](https://github.com/nks-hub/gmail-cli/releases) page, rename it to
`gmail` (`gmail.exe` on Windows), put it on your `PATH`, and — on macOS or
Linux — mark it executable with `chmod +x gmail`. Verify it against the
published `SHA256SUMS` file.

> Release binaries are not yet code-signed, so Windows SmartScreen may warn
> about an unknown publisher on first run. Choose **More info → Run anyway**.

#### From source

Requires [Bun](https://bun.sh) 1.3 or newer.

```sh
git clone https://github.com/nks-hub/gmail-cli.git
cd gmail-cli
bun install && bun run build
```

### Authentication

`gmail-cli` talks to Gmail through your own Google Cloud project, so mailbox
access stays under your control. The interactive wizard walks you through it:

```sh
gmail auth setup     # create the Google Cloud project and OAuth client
gmail auth login     # sign in through the browser
gmail auth status    # confirm you are signed in
```

### Usage

```sh
gmail inbox
gmail --json search is:unread | jq '.[].subject'
```

Global options (`--json`, `--account`, `--max-body-length`) must be given
before the command, e.g. `gmail --json inbox`.

---

## Features

| Feature | Description |
|---------|-------------|
| **Standalone binary** | Single compiled executable for Windows, macOS, and Linux — no runtime to install |
| **First-class JSON** | `--json` on every command for reliable scripting and AI-agent use |
| **Attachment support** | List and download attachments — the gap most Gmail integrations leave open |
| **Bulk operations** | Archive, trash, label, and (un)read up to 1000 messages per API call |
| **Interactive setup** | A guided wizard for the Google Cloud project and OAuth client |
| **Multiple accounts** | Switch mailboxes with `--account <name>` |
| **Secure by design** | PKCE OAuth, credentials stored locally, never any secret in the repo |
| **Resilient** | Automatic token refresh and exponential backoff on rate limits |

---

## Commands

### Authentication
| Command | Description |
|---------|-------------|
| `auth setup` | Interactive Google OAuth setup wizard |
| `auth login` / `logout` / `status` | Sign in via the browser, sign out, show status |

### Reading
| Command | Description |
|---------|-------------|
| `inbox` | List messages in the inbox |
| `search <query>` | Search with Gmail query syntax |
| `read <id>` | Read a single message |
| `batch-read <ids...>` | Read several messages in parallel |
| `threads <id>` | Read a full conversation thread |

### Organizing
| Command | Description |
|---------|-------------|
| `archive <ids...>` | Remove messages from the inbox |
| `modify <ids...>` | `--read/--unread/--star/--trash/--spam/--add-label/--remove-label` |
| `labels list\|create\|rename\|delete` | Manage labels |

### Composing
| Command | Description |
|---------|-------------|
| `send` | Compose and send a message (flags, file, or stdin) |
| `drafts list\|create\|send\|delete` | Manage drafts |

### Attachments & analysis
| Command | Description |
|---------|-------------|
| `attachments list\|download` | List and download message attachments |
| `top-senders` | Show which senders fill your inbox |

---

## Common Workflows

### 1. Triage unread mail from a script

```sh
gmail --json search is:unread | jq -r '.[] | "\(.id)\t\(.subject)"'
```

### 2. Bulk-archive newsletters

```sh
gmail --json search from:newsletter@example.com -n 100 \
  | jq -r '.[].id' | xargs gmail archive
```

### 3. Save all attachments from a message

```sh
gmail attachments download <messageId> --out ./downloads
```

### 4. Send a notification from CI

```sh
echo "Build succeeded." | gmail send --to team@example.com --subject "CI"
```

---

## Output

Every command prints human-readable text by default and structured JSON when
`--json` is set. `--max-body-length <n>` truncates message bodies (`0` =
unlimited).

---

## Security

- OAuth credentials and tokens are stored only on your machine, under
  `%APPDATA%\gmail-cli\` (Windows) or `~/.config/gmail-cli/` (macOS/Linux).
- `gmail-cli` requests only the `gmail.modify` and `gmail.send` scopes.
  Permanent deletion is intentionally unsupported — `modify --trash` moves
  messages to Trash instead.
- The repository and CI never contain any secret.

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

---

## Development

```sh
bun install        # install dependencies
bun test           # run the test suite
bun run typecheck  # type-check with tsc
bun run build      # compile the binary to dist/gmail
bun run start -- --help
```

---

## Requirements

- **To run:** nothing — the release binary is self-contained.
- **To build from source:** [Bun](https://bun.sh) 1.3 or newer.
- **A Google account** and a Google Cloud project (the `auth setup` wizard
  creates the OAuth client for you).

---

## Contributing

Contributions are welcome! For larger changes, open an issue first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: description'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Support

- 📧 **Email:** dev@nks-hub.cz
- 🐛 **Bug reports:** [GitHub Issues](https://github.com/nks-hub/gmail-cli/issues)
- 📖 **Gmail API:** [developers.google.com/gmail/api](https://developers.google.com/gmail/api)

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Links

- [Gmail API](https://developers.google.com/gmail/api)
- [Bun](https://bun.sh/)
- [NKS Hub](https://github.com/nks-hub)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/nks-hub">NKS Hub</a>
</p>
