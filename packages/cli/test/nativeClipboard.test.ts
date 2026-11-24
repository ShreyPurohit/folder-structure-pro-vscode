import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    getClipboardCommands,
    getClipboardReadCommands,
    readNativeClipboard,
    runClipboardCommand,
    writeNativeClipboard,
    type ClipboardCommand,
} from '../src/adapters/nativeClipboard.js';

const names = (commands: ClipboardCommand[]) => commands.map((command) => command.command);

describe('getClipboardCommands', () => {
    it('uses pbcopy with a UTF-8 locale on macOS', () => {
        const [command] = getClipboardCommands('darwin', {});
        expect(command).toMatchObject({ command: 'pbcopy', env: { LC_CTYPE: 'UTF-8' } });
    });

    it('prefers PowerShell, then clip.exe with a UTF-16 BOM, on Windows', () => {
        const commands = getClipboardCommands('win32', {});
        expect(names(commands)).toEqual(['powershell.exe', 'pwsh', 'clip.exe']);
        expect(commands[0].args.join(' ')).toContain('UTF8.GetString');
        expect(commands[0].timeoutMs).toBeGreaterThan(5_000);
        expect(commands[2].encoding).toBe('utf16le-bom');
    });

    it('picks Wayland and X11 tools from the session variables', () => {
        expect(names(getClipboardCommands('linux', { WAYLAND_DISPLAY: 'wayland-0' }))).toEqual([
            'wl-copy',
        ]);
        expect(names(getClipboardCommands('linux', { DISPLAY: ':0' }))).toEqual([
            'xclip',
            'xsel',
            'python3',
        ]);
        expect(
            names(getClipboardCommands('linux', { WAYLAND_DISPLAY: 'w', DISPLAY: ':0' })),
        ).toEqual(['wl-copy', 'xclip', 'xsel', 'python3']);
    });

    it('keeps the GTK helper as the last resort, on X11 only, running in the background', () => {
        const commands = getClipboardCommands('linux', { DISPLAY: ':0' });
        expect(commands.at(-1)).toMatchObject({
            command: 'python3',
            background: true,
            unavailableExitCode: 3,
            env: { GDK_BACKEND: 'x11' },
        });
        expect(commands.at(-1)!.args[0]).toBe('-c');
        expect(names(getClipboardCommands('linux', { WAYLAND_DISPLAY: 'w' }))).toEqual(['wl-copy']);
    });

    it('offers nothing on a headless Linux session', () => {
        expect(getClipboardCommands('linux', {})).toEqual([]);
    });

    it('tries the Windows tools first under WSL', () => {
        const commands = names(
            getClipboardCommands('linux', { WSL_DISTRO_NAME: 'Ubuntu', DISPLAY: ':0' }),
        );
        expect(commands.slice(0, 3)).toEqual(['powershell.exe', 'pwsh', 'clip.exe']);
        expect(commands).toContain('xclip');
    });

    it('supports Termux', () => {
        expect(names(getClipboardCommands('linux', { TERMUX_VERSION: '0.118' }))).toEqual([
            'termux-clipboard-set',
        ]);
    });

    it('has no commands for unknown platforms', () => {
        expect(getClipboardCommands('freebsd', { DISPLAY: ':0' })).toEqual([]);
    });
});

describe('writeNativeClipboard', () => {
    it('stops at the first tool that works', async () => {
        const run = vi
            .fn()
            .mockRejectedValueOnce(new Error('not found'))
            .mockResolvedValue(undefined);
        await writeNativeClipboard('hi', 'linux', { DISPLAY: ':0' }, run);
        expect(run).toHaveBeenCalledTimes(2);
        expect(run.mock.calls[1][0].command).toBe('xsel');
    });

    it('sends UTF-8 text unchanged', async () => {
        const run = vi.fn().mockResolvedValue(undefined);
        await writeNativeClipboard('café.ts', 'darwin', {}, run);
        expect(run.mock.calls[0][1]).toEqual(Buffer.from('café.ts', 'utf8'));
    });

    it('prefixes UTF-16LE text with a byte order mark for clip.exe', async () => {
        const run = vi
            .fn()
            .mockRejectedValueOnce(new Error('not found'))
            .mockRejectedValueOnce(new Error('not found'))
            .mockResolvedValue(undefined);
        await writeNativeClipboard('é', 'win32', {}, run);
        expect(run.mock.calls[2][1]).toEqual(Buffer.from([0xff, 0xfe, 0xe9, 0x00]));
    });

    it('tells Linux users which tool to install when none is found', async () => {
        const run = vi.fn().mockRejectedValue(new Error('not found'));
        await expect(writeNativeClipboard('hi', 'linux', { DISPLAY: ':0' }, run)).rejects.toThrow(
            'No clipboard tool found. Install xclip, xsel or wl-clipboard (for example: sudo apt install xclip).',
        );
    });

    it('gives Termux-specific guidance when its clipboard tool is missing', async () => {
        const run = vi.fn().mockRejectedValue(new Error('not found'));

        await expect(
            writeNativeClipboard('hi', 'linux', { TERMUX_VERSION: '0.118' }, run),
        ).rejects.toThrow(
            'Clipboard unavailable. Install Termux:API and the termux-api package to enable clipboard access.',
        );
    });

    it('reports only the tools that actually failed', async () => {
        const run = vi
            .fn()
            .mockRejectedValueOnce(new Error("Can't open display"))
            .mockRejectedValueOnce(new Error('not found'))
            .mockRejectedValueOnce(new Error('not found'));
        await expect(writeNativeClipboard('hi', 'linux', { DISPLAY: ':0' }, run)).rejects.toThrow(
            new Error("xclip failed: Can't open display"),
        );
    });

    it('explains a headless session, locally and over SSH', async () => {
        await expect(writeNativeClipboard('hi', 'linux', {}, vi.fn())).rejects.toThrow(
            'No desktop session found',
        );
        await expect(
            writeNativeClipboard('hi', 'linux', { SSH_CONNECTION: '1 2 3 4' }, vi.fn()),
        ).rejects.toThrow('This server has no desktop session');
    });

    it('explains missing tools on Windows and macOS', async () => {
        const run = vi.fn().mockRejectedValue(new Error('not found'));
        await expect(writeNativeClipboard('hi', 'win32', {}, run)).rejects.toThrow(
            'Neither PowerShell nor clip.exe could be started.',
        );
        await expect(writeNativeClipboard('hi', 'darwin', {}, run)).rejects.toThrow(
            'pbcopy was not found.',
        );
    });
});

describe('runClipboardCommand (real processes)', () => {
    const node = (script: string): ClipboardCommand => ({
        command: process.execPath,
        args: ['-e', script],
        encoding: 'utf8',
    });

    it('delivers stdin and resolves on exit code 0', async () => {
        const script =
            "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.exit(d==='héllo'?0:3))";
        await expect(runClipboardCommand(node(script), Buffer.from('héllo'))).resolves.toBe('');
    });

    it('rejects with the first stderr line on failure', async () => {
        await expect(
            runClipboardCommand(
                node("console.error('boom\\nsecond');process.exit(1)"),
                Buffer.from('x'),
            ),
        ).rejects.toThrow('boom');
    });

    it('times out a tool that never answers', async () => {
        await expect(
            runClipboardCommand(
                { ...node('setTimeout(()=>{},10000)'), timeoutMs: 300 },
                Buffer.from('x'),
            ),
        ).rejects.toThrow('did not respond in time');
    });

    it('rejects with "not found" for a missing tool', async () => {
        await expect(
            runClipboardCommand(
                { command: 'definitely-not-a-clipboard-tool', args: [], encoding: 'utf8' },
                Buffer.from('x'),
            ),
        ).rejects.toThrow('not found');
    });

    it('does not wait for a forked child that keeps the pipes open (xclip, wl-copy)', async () => {
        const script =
            "const {spawn}=require('node:child_process');" +
            "spawn(process.execPath,['-e','setTimeout(()=>{},4000)'],{detached:true,stdio:'inherit'}).unref();" +
            'process.exit(0)';
        const started = Date.now();
        await expect(runClipboardCommand(node(script), Buffer.from('x'))).resolves.toBe('');
        expect(Date.now() - started).toBeLessThan(3000);
    });
});

describe('runClipboardCommand (background tools)', () => {
    const background = (
        script: string,
        extra: Partial<ClipboardCommand> = {},
    ): ClipboardCommand => ({
        command: process.execPath,
        args: ['-e', script],
        encoding: 'utf8',
        background: true,
        timeoutMs: 3000,
        ...extra,
    });

    it('resolves once the tool says ready and leaves it running', async () => {
        const pidFile = path.join(os.tmpdir(), `fsp-bg-${process.pid}-${Date.now()}`);
        const script =
            `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));` +
            "process.stdout.write('ready\\n');setInterval(()=>{},1000)";
        const started = Date.now();
        await expect(runClipboardCommand(background(script), Buffer.from('x'))).resolves.toBe('');
        expect(Date.now() - started).toBeLessThan(2500);

        const pid = Number(fs.readFileSync(pidFile, 'utf8'));
        expect(() => process.kill(pid, 0)).not.toThrow();
        process.kill(pid);
        fs.rmSync(pidFile, { force: true });
    });

    it('reports the unavailable exit code like a missing tool', async () => {
        await expect(
            runClipboardCommand(
                background('process.exit(3)', { unavailableExitCode: 3 }),
                Buffer.from('x'),
            ),
        ).rejects.toThrow('not found');
    });

    it('reports a tool that fails before it is ready', async () => {
        await expect(
            runClipboardCommand(
                background("console.error('Cannot open the display.');process.exit(4)"),
                Buffer.from('x'),
            ),
        ).rejects.toThrow('Cannot open the display.');
        await expect(
            runClipboardCommand(background('process.exit(0)'), Buffer.from('x')),
        ).rejects.toThrow('exited before the copy finished');
    });

    it('stops a tool that never becomes ready', async () => {
        await expect(
            runClipboardCommand(
                background('setInterval(()=>{},1000)', { timeoutMs: 300 }),
                Buffer.from('x'),
            ),
        ).rejects.toThrow('did not respond in time');
    });
});

const gtkAvailable =
    process.platform === 'linux' &&
    Boolean(process.env.DISPLAY) &&
    spawnSync('python3', [
        '-c',
        "import gi; gi.require_version('Gtk','3.0'); from gi.repository import Gtk; import sys; sys.exit(0 if Gtk.init_check()[0] else 1)",
    ]).status === 0;

describe.skipIf(!gtkAvailable)('GTK helper (real desktop session)', () => {
    it('puts the text on the clipboard, accents included, and stays until replaced', async () => {
        const text = 'Directory structure:\n└── café/\n    └── ünï.ts';
        await writeNativeClipboard(text, 'linux', { DISPLAY: process.env.DISPLAY });

        const read = (script: string) =>
            spawnSync(
                'python3',
                [
                    '-c',
                    "import gi; gi.require_version('Gtk','3.0'); gi.require_version('Gdk','3.0');" +
                        'from gi.repository import Gtk, Gdk; c=Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD);' +
                        script,
                ],
                { encoding: 'utf8' },
            ).stdout;
        expect(read("print(c.wait_for_text(), end='')")).toBe(text);

        // Replace the clipboard so the helper exits and nothing is left running.
        read("c.set_text('', -1); c.store()");
    });
});

describe('reading the clipboard', () => {
    it('lists the read tool for each platform', () => {
        expect(names(getClipboardReadCommands('darwin', {}))).toEqual(['pbpaste']);
        expect(names(getClipboardReadCommands('win32', {}))).toEqual(['powershell.exe', 'pwsh']);
        expect(names(getClipboardReadCommands('linux', { WAYLAND_DISPLAY: 'w' }))).toEqual([
            'wl-paste',
        ]);
        expect(names(getClipboardReadCommands('linux', { DISPLAY: ':0' }))).toEqual([
            'xclip',
            'xsel',
            'python3',
        ]);
        expect(names(getClipboardReadCommands('linux', { TERMUX_VERSION: '1' }))).toEqual([
            'termux-clipboard-get',
        ]);
        expect(names(getClipboardReadCommands('linux', { WSL_DISTRO_NAME: 'Ubuntu' }))).toEqual([
            'powershell.exe',
            'pwsh',
        ]);
        expect(getClipboardReadCommands('linux', {})).toEqual([]);
        expect(getClipboardReadCommands('freebsd', { DISPLAY: ':0' })).toEqual([]);
    });

    it('captures output from every read tool and reads Windows text as UTF-8', () => {
        for (const platform of ['darwin', 'win32', 'linux'] as const) {
            for (const command of getClipboardReadCommands(platform, { DISPLAY: ':0' })) {
                expect(command.capture).toBe(true);
            }
        }
        const [powershell] = getClipboardReadCommands('win32', {});
        expect(powershell.args.join(' ')).toContain('UTF8Encoding');
        expect(powershell.args.join(' ')).toContain('Get-Clipboard -Raw');
        expect(powershell.timeoutMs).toBeGreaterThan(5_000);
    });

    it('returns the first tool that works and skips tools that are missing', async () => {
        const run = vi
            .fn()
            .mockRejectedValueOnce(new Error('not found'))
            .mockResolvedValueOnce('Directory structure:\n└── café/');
        await expect(readNativeClipboard('linux', { DISPLAY: ':0' }, run)).resolves.toBe(
            'Directory structure:\n└── café/',
        );
        expect(names([run.mock.calls[1][0]])).toEqual(['xsel']);
    });

    it('returns an empty string when the clipboard holds no text', async () => {
        await expect(
            readNativeClipboard('darwin', {}, vi.fn().mockResolvedValue('')),
        ).resolves.toBe('');
    });

    it('explains a missing tool or a missing display, like copying does', async () => {
        const missing = vi.fn().mockRejectedValue(new Error('not found'));
        await expect(readNativeClipboard('linux', { DISPLAY: ':0' }, missing)).rejects.toThrow(
            'No clipboard tool found.',
        );
        await expect(readNativeClipboard('linux', {}, vi.fn())).rejects.toThrow(
            'No desktop session found',
        );
    });
});

describe('runClipboardCommand (capturing output)', () => {
    const reader = (script: string): ClipboardCommand => ({
        command: process.execPath,
        args: ['-e', script],
        encoding: 'utf8',
        capture: true,
        timeoutMs: 3000,
    });

    it('returns everything the tool printed, including non-ASCII text and a large amount', async () => {
        const output = await runClipboardCommand(
            reader("process.stdout.write('└── café/\\n'.repeat(20000))"),
            Buffer.alloc(0),
        );
        expect(output).toBe('└── café/\n'.repeat(20000));
    });

    it('reports a failing tool by its first error line', async () => {
        await expect(
            runClipboardCommand(
                reader("console.error('Cannot open the display.\\nmore');process.exit(4)"),
                Buffer.alloc(0),
            ),
        ).rejects.toThrow('Cannot open the display.');
    });

    it('treats the unavailable exit code like a missing tool', async () => {
        await expect(
            runClipboardCommand(
                { ...reader('process.exit(3)'), unavailableExitCode: 3 },
                Buffer.alloc(0),
            ),
        ).rejects.toThrow('not found');
    });
});

describe.skipIf(!gtkAvailable)('clipboard round trip (real desktop session)', () => {
    it('reads back exactly what was copied', async () => {
        const text = 'Directory structure:\n└── proj/\n    └── café-ünï.ts';
        await writeNativeClipboard(text, 'linux', { DISPLAY: process.env.DISPLAY });
        await expect(readNativeClipboard('linux', { DISPLAY: process.env.DISPLAY })).resolves.toBe(
            text,
        );
        // Take over the clipboard so the helper exits and nothing is left running.
        spawnSync('python3', [
            '-c',
            "import gi; gi.require_version('Gtk','3.0'); gi.require_version('Gdk','3.0');" +
                'from gi.repository import Gtk, Gdk; c=Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD);' +
                "c.set_text('', -1); c.store()",
        ]);
    });
});
