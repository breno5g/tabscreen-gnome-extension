# TabScreen GNOME extension

A Quick Settings toggle for [TabScreen](https://github.com/breno5g/tabscreen):
it starts and stops `tabscreen-host` over USB and picks how frames are captured,
on the CPU or on the GPU.

## What's here

| Path | What it does |
|---|---|
| `extension/tabscreen@breno5g/` | GNOME Shell extension. The toggle starts or stops the host; its menu picks the capture mode, saved in `~/.config/tabscreen/capture` (default GPU), and restarts a running host when the mode changes |
| `bin/tabscreen-toggle` | Starts the host if it isn't running, otherwise stops it (Ctrl+C, then SIGKILL after 5 s). Logs to `$XDG_RUNTIME_DIR/tabscreen.log` |
| `bin/tabscreen` | Runs `tabscreen-host --usb` with defaults (`--capture gpu`, `--bitrate 30000`) and sets each new virtual monitor to 200 % |

## Requirements

- GNOME Shell 50 on Wayland
- TabScreen built at `~/Development/projects/tabscreen` (`cargo build --release`
  in `host/`). `bin/tabscreen` uses that path.
- GPU capture needs an NVIDIA GPU with NVENC; pick CPU in the menu otherwise.

## Install

```sh
./install.sh
```

It links the extension and both scripts from this repo into
`~/.local/share/gnome-shell/extensions/` and `~/.local/bin/`, so edits here take
effect. Log out and back in afterwards: GNOME on Wayland only loads extension
code at login.

## Use

- Click **TabScreen** in Quick Settings. The tablet opens the page by itself
  (`--usb`); tap it once for fullscreen.
- The arrow next to it opens the menu: **CPU** (up to 120 fps, more CPU) or
  **GPU** (a third of the CPU and less power). The subtitle shows the mode.
- From a terminal, `tabscreen` takes any `tabscreen-host` option and overrides
  the defaults, e.g. `tabscreen --capture cpu`.
