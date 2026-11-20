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
const MODES = [
    ['cpu', 'CPU', 'Captura pela CPU (até 120 fps)'],
    ['gpu', 'GPU', 'Captura pela GPU (menos CPU e energia)'],
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
        Main.notifyError('TabScreen', `Não consegui salvar a opção: ${e.message}`);
    }
}

const TabScreenToggle = GObject.registerClass(
class TabScreenToggle extends QuickMenuToggle {
    constructor() {
        super({title: 'TabScreen', iconName: 'video-display-symbolic', toggleMode: false});
        this._cancellable = new Gio.Cancellable();
        this.connect('destroy', () => this._cancellable.cancel());
        this.connect('clicked', () => (this.checked ? this._stop() : this._start()));

        this._capture = load('capture', MODES.map(([mode]) => mode), 'gpu'); // gpu: the wrapper's default
        this._wifi = load('wifi', ['on', 'off'], 'off') === 'on';
        this.menu.setHeader('video-display-symbolic', 'TabScreen', 'Modo de captura');
        this._items = new Map(MODES.map(([mode, , label]) => {
            const item = new PopupMenu.PopupMenuItem(label);
            item.connect('activate', () => this._setCapture(mode));
            this.menu.addMenuItem(item);
            return [mode, item];
        }));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Rede'));
        const wifi = new PopupMenu.PopupSwitchMenuItem('Também pela rede (Wi-Fi)', this._wifi);
        wifi.connect('toggled', (_item, on) => this._setWifi(on));
        this.menu.addMenuItem(wifi);
        this._linkItem = new PopupMenu.PopupMenuItem('Mostrar link (QR code)');
        this._linkItem.connect('activate', () => this._showLink());
        this.menu.addMenuItem(this._linkItem);
        this._syncOptions();

        // The host can also be started or stopped from a terminal, so re-check whenever the menu opens.
        Main.panel.statusArea.quickSettings.menu.connectObject('open-state-changed',
            (_menu, open) => open && this._sync(), this);
        this._sync();
    }

    _start() {
        this.checked = true;
        try {
            // Always explicit: the wrapper has its own default.
            const args = [TOGGLE, '--capture', this._capture, ...(this._wifi ? ['--wifi'] : [])];
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

    _setCapture(mode) {
        if (mode === this._capture)
            return;
        this._capture = mode;
        save('capture', mode);
        this._optionsChanged();
    }

    _setWifi(on) {
        this._wifi = on;
        save('wifi', on ? 'on' : 'off');
        this._optionsChanged();
    }

    _optionsChanged() {
        this._syncOptions();
        // A running host keeps its options until restarted, so restart it now.
        if (this.checked)
            this._stop(() => this._start());
    }

    _syncOptions() {
        for (const [mode, item] of this._items)
            item.setOrnament(mode === this._capture ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        this._linkItem.visible = this._wifi;
        const capture = MODES.find(([mode]) => mode === this._capture)[1];
        this.subtitle = this._wifi ? `${capture} · Wi-Fi` : capture;
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
        if (!this.checked || !url) {
            Main.notifyError('TabScreen', 'Ligue o TabScreen com a rede ativada para gerar o link');
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
                    Main.notifyError('TabScreen', `Não consegui abrir o QR code: ${e.message}`);
                }
            });
            Main.notify('TabScreen', 'Link copiado. Escaneie o QR code no tablet.');
        } catch {
            Main.notify('TabScreen', 'Link copiado. Instale o qrencode para ver o QR code.');
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
