# Security Policy

## Reporting a Vulnerability

Please report security issues by opening a
[private security advisory](https://github.com/nks-hub/gmail-cli/security/advisories/new)
rather than a public issue.

We aim to acknowledge reports within 7 days.

## Credential Handling

`gmail-cli` is designed so that no secrets ever enter the repository or CI:

- OAuth client credentials and tokens are stored only on the local machine,
  under `%APPDATA%\gmail-cli\` (Windows) or `~/.config/gmail-cli/` (POSIX).
- Token files are written with `0600` permissions on POSIX systems.
- The OAuth flow uses PKCE; the application is registered as a Desktop /
  Installed app, for which Google does not treat the client secret as
  confidential.
- `gmail-cli` requests only the `gmail.modify` and `gmail.send` scopes.
  Permanent deletion of mail is not supported by design.

Never commit `credentials.json`, `token.json`, or any `client_secret*.json`
file. These patterns are excluded by `.gitignore`.
