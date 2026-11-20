#!/bin/sh
# Link the extension and its scripts from this repo into place, so edits here
# take effect without copying. Safe to run again.
#   ./install.sh [PATH_TO_TABSCREEN_HOST]   also links tabscreen-host into ~/.local/bin
set -eu
repo=$(cd "$(dirname "$0")" && pwd)
ext=tabscreen@breno5g
ext_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
bin_dir="$HOME/.local/bin"

link() { # TARGET LINK
    if [ -e "$2" ] && [ ! -L "$2" ]; then
        echo "$2 exists and isn't a symlink; move it away first" >&2
        exit 1
    fi
    ln -sfn "$1" "$2"
    echo "$2 -> $1"
}

mkdir -p "$ext_dir" "$bin_dir"
link "$repo/extension/$ext" "$ext_dir/$ext"
link "$repo/bin/tabscreen" "$bin_dir/tabscreen"
link "$repo/bin/tabscreen-toggle" "$bin_dir/tabscreen-toggle"
if [ $# -ge 1 ]; then
    if [ ! -x "$1" ]; then
        echo "$1 isn't an executable tabscreen-host" >&2
        exit 1
    fi
    link "$(realpath "$1")" "$bin_dir/tabscreen-host"
elif ! command -v tabscreen-host >/dev/null && [ ! -e "$bin_dir/tabscreen-host" ]; then
    echo "tabscreen-host not found: run ./install.sh /path/to/tabscreen-host" >&2
fi
gnome-extensions enable "$ext" 2>/dev/null || true
echo "Log out and back in to load extension changes (GNOME on Wayland can't reload them)."
