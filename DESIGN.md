# Design brief: TabScreen GNOME extension

## Product

A Quick Settings toggle that starts and stops `tabscreen-host` (an Android
tablet as a touch second monitor) and holds its options. Its one job: turn the
tablet screen on or off in one click, with the options already right.

## Audience and voice

- The author, on their own tablet (2800×1752, 120 Hz, S Pen) and laptop
  (GNOME 50, Wayland, NVIDIA). A personal tool, no other users (assumed).
- Interface text in English: short labels, sentence case, the current value
  visible without opening anything.
- Notifications say what happened and, on errors, what to do next.

## Mood

Native. It should look and behave like GNOME's own Quick Settings (Power Mode,
Wi-Fi, Bluetooth), so nothing gives away that it's an extension.

## Brand

None of its own. Design system source: GNOME Shell's stock widgets
(`QuickMenuToggle`, `PopupMenuItem` with check ornaments, `PopupSwitchMenuItem`,
`PopupSeparatorMenuItem`, `PopupSubMenuMenuItem`) and the Shell theme. No
custom CSS; icons come from the symbolic icon theme (`video-display-symbolic`).

## References

- **GNOME Quick Settings › Power Mode** — take: a single choice as a list with
  a check on the current item. Avoid: nothing noted (assumed).
- **GNOME Quick Settings › Wi-Fi and Bluetooth** — take: the menu header shows
  icon, title and current state; the toggle's subtitle sums up the state.
  Avoid: lists so long the menu runs off the screen (assumed).

## Constraints

- GNOME Shell 50 on Wayland: extension code only reloads at login, so changes
  can't be tried without logging out.
- Every option maps to a `tabscreen-host` or `bin/tabscreen` option. Changing
  one while the host runs restarts it (a few seconds without the tablet).
- Options persist across logins, one file per option in `~/.config/tabscreen/`.
- The laptop screen limits how tall the Quick Settings menu can grow (assumed).

## Decisions log

- 2026-11-20 — Capture mode is a check list in the menu; Wi-Fi is a switch
  plus a "show link (QR code)" item (existing design, recorded at setup).
- 2026-11-20 — Interface text in English, including existing strings: the
  author asked for it.
- 2026-11-20 — Settings live in the Quick Settings menu as expandable sections
  (one row per setting showing its value, a check list inside), not in a
  preferences window: everything stays one click away, like the capture mode.
- 2026-11-20 — Settings: capture, resolution, frame rate, bitrate, scale, plus
  the Wi-Fi section. Frame rate needs a new `--max-fps` in `tabscreen-host`.
- 2026-11-20 — No design tool: GNOME Shell's widgets are the design system,
  so there's nothing to import or draw outside the Shell.
- 2026-11-20 — "Show link (QR code)" is greyed out while TabScreen is off,
  instead of answering a click with an error.
- 2026-11-20 — The toggle's subtitle shows only capture and Wi-Fi: all five
  settings wouldn't fit the tile.
- 2026-11-20 — Values on the rows use the menu's normal text style: the Shell
  theme has no secondary-text class, and the brief rules out custom CSS.

## Open questions

- None.
