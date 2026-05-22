# gmail-cli

A fast, scriptable Gmail command-line client with first-class JSON output.

`gmail-cli` is a single, dependency-free binary for reading, searching,
sending and organising Gmail from the terminal or from scripts. It compiles
for Windows, macOS and Linux, and every command can emit structured JSON,
which makes it a practical building block for automation and AI agents.

## Features

- Read, search, send and reply to mail
- Manage labels, drafts and conversation threads
- List and download attachments
- Bulk archive, trash, mark read/unread and (un)star with one call
- `top-senders` analysis to find what fills your inbox
- `--json` output on every command for scripting
- Multiple accounts via `--account`
- Interactive OAuth setup wizard — no manual JSON wrangling
- Credentials and tokens stay on your machine; nothing is committed or uploaded

## Installation

### Download a release binary

Download the binary for your platform from the
[Releases](https://github.com/nks-hub/gmail-cli/releases) page, rename it to
`gmail` (or `gmail.exe` on Windows), put it on your `PATH`, and — on macOS or
Linux — mark it executable:

```sh
chmod +x gmail
```

Verify the download against the published `SHA256SUMS` file.

> The release binaries are not yet code-signed, so Windows SmartScreen may warn
> about an unknown publisher on first run. Choose **More info -> Run anyway**.

### Build from source

Requires [Bun](https://bun.sh) 1.3 or newer.

```sh
git clone https://github.com/nks-hub/gmail-cli.git
cd gmail-cli
bun install
bun run build        # produces dist/gmail
```

## Getting started

`gmail-cli` talks to Gmail through your own Google Cloud project, so your
mailbox access stays under your control. The setup wizard walks you through it:

```sh
gmail auth setup     # interactive: create the Google project and OAuth client
gmail auth login     # sign in through the browser
gmail auth status    # confirm you are signed in
```

The wizard guides you through creating a Google Cloud project, enabling the
Gmail API, configuring the OAuth consent screen and creating a **Desktop app**
OAuth client. It takes about five minutes.

## Usage

```text
gmail [global options] <command> [command options]
```

Global options must be given before the command, for example
`gmail --json inbox`.

| Global option | Description |
|---|---|
| `--json` | Emit structured JSON instead of formatted text |
| `--account <name>` | Use a named account profile |
| `--max-body-length <n>` | Truncate message bodies to N characters (0 = unlimited) |

### Examples

```sh
# List the inbox
gmail inbox
gmail inbox -n 50

# Search with Gmail query syntax
gmail search from:linkedin.com is:unread
gmail search "before:2025/06/01 larger:5M"

# Read messages
gmail read 1920af...
gmail batch-read 1920af... 1920b0... 1920b1...

# Organise
gmail archive 1920af... 1920b0...
gmail modify 1920af... --read --add-label "Receipts"
gmail modify 1920af... --trash

# Labels, drafts and threads
gmail labels list
gmail labels create "Receipts"
gmail drafts create --to a@b.com --subject "Hi" --body "Draft body"
gmail threads 1920af...

# Attachments
gmail attachments list 1920af...
gmail attachments download 1920af... --out ./downloads

# Send (body from a flag, a file, or stdin)
gmail send --to a@b.com --subject "Report" --body "See attached notes."
echo "Body from stdin" | gmail send --to a@b.com --subject "Hi"

# Find your noisiest senders
gmail top-senders --top 15 --scan 500

# JSON output for scripting
gmail --json search is:unread | jq '.[].subject'
```

## Security

- OAuth credentials and tokens are stored only on your machine, under
  `%APPDATA%\gmail-cli\` (Windows) or `~/.config/gmail-cli/` (macOS/Linux).
- `gmail-cli` requests only the `gmail.modify` and `gmail.send` scopes.
  Permanent deletion of mail is intentionally unsupported — `modify --trash`
  moves messages to Trash instead.
- The repository and CI never contain any secrets.

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## Development

```sh
bun install
bun test           # run the unit test suite
bun run typecheck  # type-check with tsc
bun run start -- --help
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](LICENSE)
