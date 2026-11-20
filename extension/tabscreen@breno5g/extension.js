import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const TOGGLE = GLib.build_filenamev([GLib.get_home_dir(), '.local/bin/tabscreen-toggle']);
const CONFIG_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'tabscreen']);
// Written by tabscreen-toggle; the host prints the Wi-Fi link there at startup.
const LOG = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'tabscreen.log']);
const QR_PNG = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'tabscreen-qr.png']);

/**
 * The menu's settings, in order. `args` turns the chosen value into options for
 * bin/tabscreen. Each choice: [value, label on the row, label in the list].
 */
const SETTINGS = [
    {
        key: 'capture', title: 'Capture', fallback: 'gpu', // the wrapper's default
        args: v => ['--capture', v],
        choices: [['cpu', 'CPU', 'CPU (smoothest motion)'], ['gpu', 'GPU', 'GPU (less CPU and power)']],
    },
    {
        key: 'resolution', title: 'Resolution', fallback: 'auto',
        args: v => (v === 'auto' ? [] : ['--size', v]),
        choices: [
            ['auto', 'Automatic', 'Automatic (tablet’s size)'],
            ['2560x1600', '2560 × 1600'],
            ['1920x1200', '1920 × 1200'],
            ['1280x800', '1280 × 800'],
        ],
    },
    {
        key: 'fps', title: 'Frame rate', fallback: '120',
        args: v => ['--max-fps', v],
        choices: [['30', '30 fps'], ['60', '60 fps'], ['120', '120 fps']],
    },
    {
        key: 'bitrate', title: 'Bitrate', fallback: 'auto',
        args: v => (v === 'auto' ? [] : ['--bitrate', v]),
        choices: [
            ['auto', 'Automatic', 'Automatic (30 Mbit/s, 12 with Wi-Fi)'],
            ['6000', '6 Mbit/s'],
            ['12000', '12 Mbit/s'],
            ['20000', '20 Mbit/s'],
            ['30000', '30 Mbit/s'],
            ['50000', '50 Mbit/s'],
        ],
    },
    {
        key: 'scale', title: 'Scale', fallback: '2',
        args: v => ['--scale', v],
        choices: [['1', '100%'], ['1.5', '150%'], ['2', '200%']],
    },
];

/** A choice made in the menu, kept across logins in ~/.config/tabscreen/NAME. */
function load(name, values, fallback) {
    try {
        const [, bytes] = GLib.file_get_contents(GLib.build_filenamev([CONFIG_DIR, name]));
        const value = new TextDecoder().decode(bytes).trim();
        return values.includes(value) ? value : fallback;
    } catch {
        return fallback; // nothing saved yet
    }
}

function save(name, value) {
    try {
        GLib.mkdir_with_parents(CONFIG_DIR, 0o700);
        GLib.file_set_contents(GLib.build_filenamev([CONFIG_DIR, name]), `${value}\n`);
    } catch (e) {
        Main.notifyError('TabScreen', `Couldn't save the setting: ${e.message}`);
    }
}

const TabScreenToggle = GObject.registerClass(
class TabScreenToggle extends QuickMenuToggle {
    constructor() {
        super({title: 'TabScreen', iconName: 'video-display-symbolic', toggleMode: false});
        this._cancellable = new Gio.Cancellable();
        this.connect('destroy', () => this._cancellable.cancel());
        this.connect('clicked', () => (this.checked ? this._stop() : this._start()));

        this._values = Object.fromEntries(SETTINGS.map(s => [s.key, load(s.key, s.choices.map(([v]) => v), s.fallback)]));
        this._values.wifi = load('wifi', ['on', 'off'], 'off');

        // One expandable row per setting: its value on the right, the choices inside.
        this._rows = SETTINGS.map(setting => {
            const row = new PopupMenu.PopupSubMenuMenuItem(setting.title);
            const value = new St.Label({y_align: Clutter.ActorAlign.CENTER});
            row.insert_child_at_index(value, row.get_n_children() - 1); // before the arrow, the row's last child
            const items = new Map(setting.choices.map(([choice, label, listLabel]) => {
                const item = new PopupMenu.PopupMenuItem(listLabel ?? label);
                item.connect('activate', () => this._set(setting.key, choice));
                row.menu.addMenuItem(item);
                return [choice, item];
            }));
            this.menu.addMenuItem(row);
            return {setting, value, items};
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Network'));
        const wifi = new PopupMenu.PopupSwitchMenuItem('Also over Wi-Fi', this._values.wifi === 'on');
        wifi.connect('toggled', (_item, on) => this._set('wifi', on ? 'on' : 'off'));
        this.menu.addMenuItem(wifi);
        this._linkItem = new PopupMenu.PopupMenuItem('Show link (QR code)');
        this._linkItem.connect('activate', () => this._showLink());
        this.menu.addMenuItem(this._linkItem);
        // The link only exists while the host runs.
        this.connect('notify::checked', () => this._syncOptions());
        this._syncOptions();

        // The host can also be started or stopped from a terminal, so re-check whenever the menu opens.
        Main.panel.statusArea.quickSettings.menu.connectObject('open-state-changed',
            (_menu, open) => open && this._sync(), this);
        this._sync();
    }

    _start() {
        this.checked = true;
        try {
            // Always explicit where the wrapper has its own default.
            const args = [TOGGLE, ...SETTINGS.flatMap(s => s.args(this._values[s.key]))];
            if (this._values.wifi === 'on')
                args.push('--wifi');
            const proc = Gio.Subprocess.new(args, Gio.SubprocessFlags.NONE);
            this._proc = proc;
            // The script only returns once the host has stopped. During a restart the
            // next host may already run, so only the current one turns the toggle off.
            this._onExit(proc, () => {
                if (this._proc === proc) {
                    this._proc = null;
                    this.checked = false;
                }
            });
        } catch (e) {
            this.checked = false;
            Main.notifyError('TabScreen', e.message);
        }
    }

    /** Stop the host; `then` runs once it has stopped. */
    _stop(then) {
        this.checked = false;
        try {
            const proc = Gio.Subprocess.new([TOGGLE], Gio.SubprocessFlags.NONE);
            if (then)
                this._onExit(proc, then);
        } catch (e) {
            Main.notifyError('TabScreen', e.message);
        }
    }

    _set(key, value) {
        if (this._values[key] === value)
            return;
        this._values[key] = value;
        save(key, value);
        this._syncOptions();
        // A running host keeps its options until restarted, so restart it now.
        if (this.checked)
            this._stop(() => this._start());
    }

    _syncOptions() {
        for (const {setting, value, items} of this._rows) {
            const current = this._values[setting.key];
            value.text = setting.choices.find(([choice]) => choice === current)[1];
            for (const [choice, item] of items)
                item.setOrnament(choice === current ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }
        const wifi = this._values.wifi === 'on';
        this._linkItem.visible = wifi;
        this._linkItem.setSensitive(this.checked);
        const capture = this._rows.find(r => r.setting.key === 'capture').value.text;
        this.subtitle = wifi ? `${capture} · Wi-Fi` : capture;
        this.menu.setHeader('video-display-symbolic', 'TabScreen', this.subtitle);
    }

    /** Copy the running host's Wi-Fi link and open it as a QR code for the tablet to scan. */
    _showLink() {
        let url;
        try {
            const [, bytes] = GLib.file_get_contents(LOG);
            url = new TextDecoder().decode(bytes).match(/https:\/\/\S+#t=\S+/)?.[0];
        } catch {
            // no log yet: handled below
        }
        if (!url) {
            Main.notifyError('TabScreen', 'No Wi-Fi link yet. Wait a few seconds after turning TabScreen on.');
            return;
        }
        // The link carries the access token, so it stays out of the notification text.
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, url);
        try {
            const qr = Gio.Subprocess.new(['qrencode', '-s', '10', '-o', QR_PNG, url], Gio.SubprocessFlags.NONE);
            this._onExit(qr, p => {
                try {
                    if (p.get_successful())
                        Gio.AppInfo.launch_default_for_uri(Gio.File.new_for_path(QR_PNG).get_uri(), null);
                } catch (e) {
                    Main.notifyError('TabScreen', `Couldn't open the QR code: ${e.message}`);
                }
            });
            Main.notify('TabScreen', 'Link copied. Scan the QR code with the tablet.');
        } catch {
            Main.notify('TabScreen', 'Link copied. Install qrencode to see it as a QR code.');
        }
    }

    _sync() {
        const proc = Gio.Subprocess.new(['pgrep', '-x', 'tabscreen-host'], Gio.SubprocessFlags.STDOUT_SILENCE);
        this._onExit(proc, p => (this.checked = p.get_successful()));
    }

    _onExit(proc, callback) {
        proc.wait_async(this._cancellable, (p, res) => {
            try {
                p.wait_finish(res);
            } catch {
                return; // cancelled: the toggle was destroyed
            }
            callback(p);
        });
    }
});

const Indicator = GObject.registerClass(
class Indicator extends SystemIndicator {
    constructor() {
        super();
        this.quickSettingsItems.push(new TabScreenToggle());
    }
});

export default class TabScreenExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
        this._indicator = null;
    }
}
