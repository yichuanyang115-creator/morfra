#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
developer_root="$(printf '%s\n' "$workspace_root" | awk -F/ '{print "/" $2 "/" $3}')"

export RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=${developer_root}=/workspace"
exec pnpm tauri build "$@"
