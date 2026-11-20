# TabScreen GNOME extension

A Quick Settings toggle for [TabScreen](https://github.com/breno5g/tabscreen):
it starts and stops `tabscreen-host` over USB, optionally over Wi-Fi too, and
picks how frames are captured, on the CPU or on the GPU.

## What's here

| Path | What it does |
|---|---|
| `extension/tabscreen@breno5g/` | GNOME Shell extension. The toggle starts or stops the host; its menu picks the capture mode and Wi-Fi, saved in `~/.config/tabscreen/capture` (default GPU) and `~/.config/tabscreen/wifi` (default off), and restarts a running host when they change |
| `bin/tabscreen-toggle` | Starts the host if it isn't running, otherwise stops it (Ctrl+C, then SIGKILL after 5 s). Logs to `$XDG_RUNTIME_DIR/tabscreen.log` |
| `bin/tabscreen` | Runs `tabscreen-host --usb` with defaults (`--capture gpu`, `--bitrate 30000`; with `--wifi`, the host's 12000) and sets each new virtual monitor to 200 % |

## Requirements

- GNOME Shell 50 on Wayland
- TabScreen built at `~/Development/projects/tabscreen` (`cargo build --release`
  in `host/`). `bin/tabscreen` uses that path.
- GPU capture needs an NVIDIA GPU with NVENC; pick CPU in the menu otherwise.
- For Wi-Fi: `qrencode` to show the link as a QR code (optional; the link is
  copied either way), and port 8766 open if a firewall is active, e.g.
  `sudo ufw allow from 192.168.0.0/24 to any port 8766 proto tcp`.

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
- **Também pela rede (Wi-Fi)** in the menu adds `--wifi`: the tablet (or any
  device on the network) can connect without a cable, at a lower bitrate.
  **Mostrar link (QR code)** copies the host's link and opens it as a QR code;
  scan it on the tablet, accept the certificate warning once and bookmark the
  page. The link holds the access token: anyone with it can control the screen.
- From a terminal, `tabscreen` takes any `tabscreen-host` option and overrides
  the defaults, e.g. `tabscreen --capture cpu`.
