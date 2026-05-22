# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `install.sh` and `install.ps1` install scripts that download the latest
  release binary, verify its checksum, and add it to `PATH`.

## [0.1.0] - 2026-05-22

### Added

- Interactive OAuth setup wizard (`gmail auth setup`).
- Browser-based sign-in with the OAuth 2.0 loopback + PKCE flow.
- Commands: `inbox`, `search`, `read`, `batch-read`, `archive`, `modify`,
  `send`, `labels`, `drafts`, `threads`, `attachments`, `top-senders`.
- First-class JSON output via the global `--json` flag.
- Named-account support via the global `--account` flag.
- Cross-platform release binaries for Windows, macOS and Linux.
