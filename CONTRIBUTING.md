# Contributing

Thanks for your interest in improving `gmail-cli`.

## Development setup

```sh
bun install
bun test
bun run typecheck
bun run start -- --help
```

## Guidelines

- Keep pull requests focused and small.
- Add or update tests for any behaviour change; `bun test` must pass.
- Run `bun run typecheck` before submitting.
- Never commit credentials, tokens, or `client_secret*.json` files.
- Follow the existing code style; documentation comments are in English.

## Commit messages

Use short, single-line, imperative commit subjects, for example
`add thread pagination` or `fix label name resolution`.
