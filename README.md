# TabScreen GNOME extension

A Quick Settings toggle for [TabScreen](https://github.com/breno5g/tabscreen):
it starts and stops `tabscreen-host` over USB, optionally over Wi-Fi too, and
holds its settings: capture, resolution, frame rate, bitrate and scale.

## What's here

| Path | What it does |
|---|---|
| `extension/tabscreen@breno5g/` | GNOME Shell extension. The toggle starts or stops the host; its menu holds the settings, one file each in `~/.config/tabscreen/` (`capture`, `resolution`, `fps`, `bitrate`, `scale`, `wifi`), and restarts a running host when one changes |
| `bin/tabscreen-toggle` | Starts the host if it isn't running, otherwise stops it (Ctrl+C, then SIGKILL after 5 s). Logs to `$XDG_RUNTIME_DIR/tabscreen.log` |
| `bin/tabscreen` | Runs `tabscreen-host --usb` with defaults (`--capture gpu`, `--bitrate 30000`; with `--wifi`, the host's 12000) and sets each new virtual monitor to `--scale` (default 2, i.e. 200 %) |

## Requirements

- GNOME Shell 50 on Wayland
- TabScreen built at `~/Development/projects/tabscreen` (`cargo build --release`
  in `host/`), recent enough to have `--max-fps`. `bin/tabscreen` uses that path.
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
- The arrow next to it opens the menu. Each row shows a setting's value; click
  it to pick another. Changing one restarts a running host.

  | Setting | Choices | Default |
  |---|---|---|
  | Capture | CPU (smoothest motion), GPU (a third of the CPU, less power) | GPU |
  | Resolution | Automatic (the tablet's), 2560 × 1600, 1920 × 1200, 1280 × 800 | Automatic |
  | Frame rate | 30, 60, 120 fps (most frames per second) | 120 fps |
  | Bitrate | Automatic (30 Mbit/s, 12 with Wi-Fi), 6–50 Mbit/s | Automatic |
  | Scale | 100 %, 150 %, 200 % | 200 % |

  A fixed resolution doesn't follow the tablet's rotation: in portrait the
  picture gets black bars. The toggle's subtitle shows the capture mode and
  Wi-Fi.
- **Also over Wi-Fi** adds `--wifi`: the tablet (or any device on the network)
  can connect without a cable. **Show link (QR code)**, available while
  TabScreen is on, copies the host's link and opens it as a QR code; scan it on
  the tablet, accept the certificate warning once and bookmark the page. The
  link holds the access token: anyone with it can control the screen.
- From a terminal, `tabscreen` takes any `tabscreen-host` option and overrides
  the defaults, e.g. `tabscreen --capture cpu --max-fps 60 --scale 1.5`.
