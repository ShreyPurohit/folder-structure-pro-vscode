import { describe, expect, it, vi } from 'vitest';
import {
    getClipboardCommands,
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
        expect(names(getClipboardCommands('linux', { DISPLAY: ':0' }))).toEqual(['xclip', 'xsel']);
        expect(
            names(getClipboardCommands('linux', { WAYLAND_DISPLAY: 'w', DISPLAY: ':0' })),
        ).toEqual(['wl-copy', 'xclip', 'xsel']);
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
        await expect(
            runClipboardCommand(node(script), Buffer.from('héllo')),
        ).resolves.toBeUndefined();
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
        await expect(runClipboardCommand(node(script), Buffer.from('x'))).resolves.toBeUndefined();
        expect(Date.now() - started).toBeLessThan(3000);
    });
});
