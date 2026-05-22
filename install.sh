#!/bin/sh
# gmail-cli installer for macOS and Linux.
# Usage: curl -fsSL https://raw.githubusercontent.com/nks-hub/gmail-cli/main/install.sh | sh
set -eu

REPO="nks-hub/gmail-cli"
BINARY="gmail"
INSTALL_DIR="${GMAIL_CLI_INSTALL_DIR:-$HOME/.local/bin}"

info() { printf '%s\n' "$*" >&2; }
err() { printf 'Error: %s\n' "$*" >&2; exit 1; }

# --- Detect platform -------------------------------------------------------
os=$(uname -s)
arch=$(uname -m)
case "$os" in
  Linux) os_name="linux" ;;
  Darwin) os_name="darwin" ;;
  *) err "Unsupported operating system: $os (use install.ps1 on Windows)." ;;
esac
case "$arch" in
  x86_64 | amd64) arch_name="x64" ;;
  aarch64 | arm64) arch_name="arm64" ;;
  *) err "Unsupported architecture: $arch" ;;
esac
asset="${BINARY}-${os_name}-${arch_name}"

# --- Pick a downloader -----------------------------------------------------
if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  download() { wget -qO "$2" "$1"; }
else
  err "Either curl or wget is required."
fi

base="https://github.com/${REPO}/releases/latest/download"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# --- Download --------------------------------------------------------------
info "Downloading ${asset} from the latest release..."
download "${base}/${asset}" "${tmp}/${BINARY}" || err "Download failed."
download "${base}/SHA256SUMS" "${tmp}/SHA256SUMS" || err "Could not fetch checksums."

# --- Verify checksum -------------------------------------------------------
expected=$(grep " ${asset}$" "${tmp}/SHA256SUMS" | awk '{print $1}')
[ -n "$expected" ] || err "No checksum published for ${asset}."
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "${tmp}/${BINARY}" | awk '{print $1}')
elif command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "${tmp}/${BINARY}" | awk '{print $1}')
else
  err "Either sha256sum or shasum is required to verify the download."
fi
[ "$expected" = "$actual" ] || err "Checksum mismatch; aborting."
info "Checksum verified."

# --- Install ---------------------------------------------------------------
mkdir -p "$INSTALL_DIR"
mv "${tmp}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
chmod +x "${INSTALL_DIR}/${BINARY}"
info "Installed to ${INSTALL_DIR}/${BINARY}"

# --- PATH integration ------------------------------------------------------
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*)
    info "${INSTALL_DIR} is already on your PATH."
    ;;
  *)
    case "$(basename "${SHELL:-sh}")" in
      zsh) profile="$HOME/.zshrc" ;;
      bash) profile="$HOME/.bashrc" ;;
      *) profile="$HOME/.profile" ;;
    esac
    line="export PATH=\"${INSTALL_DIR}:\$PATH\""
    if ! { [ -f "$profile" ] && grep -qF "$line" "$profile"; }; then
      printf '\n# Added by the gmail-cli installer\n%s\n' "$line" >>"$profile"
      info "Added ${INSTALL_DIR} to your PATH in ${profile}."
    fi
    info "Restart your shell, or run: ${line}"
    ;;
esac

info ""
info "Done. Get started with: ${BINARY} auth setup"
