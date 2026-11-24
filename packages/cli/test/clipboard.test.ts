import { describe, expect, it, vi } from 'vitest';
import { MissingClipboardToolError } from '../src/adapters/nativeClipboard.js';
import {
    ClipboardUnavailableError,
    createClipboard,
    describeCopy,
    OSC52_MAX_BASE64_LENGTH,
} from '../src/adapters/clipboard.js';

function setup(
    env: NodeJS.ProcessEnv,
    options: { nativeFails?: boolean; terminal?: boolean; platform?: NodeJS.Platform } = {},
) {
    const nativeWrite = options.nativeFails
        ? vi.fn().mockRejectedValue(new Error('No clipboard tool found.'))
        : vi.fn().mockResolvedValue(undefined);
    const writeToTerminal = vi.fn().mockReturnValue(options.terminal ?? true);
    const adapter = createClipboard({
        env,
        platform: options.platform ?? 'linux',
        nativeWrite,
        writeToTerminal,
    });
    return { adapter, nativeWrite, writeToTerminal };
}

describe('clipboard adapter', () => {
    it('uses the system clipboard locally', async () => {
        const { adapter, nativeWrite, writeToTerminal } = setup({ DISPLAY: ':0' });
        await adapter.write('hi');
        expect(nativeWrite).toHaveBeenCalledWith('hi');
        expect(writeToTerminal).not.toHaveBeenCalled();
    });

    it('falls back to the terminal when the system clipboard fails', async () => {
        const { adapter, writeToTerminal } = setup({ DISPLAY: ':0' }, { nativeFails: true });
        await expect(adapter.write('hi')).resolves.toBe('terminal');
        expect(writeToTerminal).toHaveBeenCalledWith(
            `\u001b]52;c;${Buffer.from('hi').toString('base64')}\u0007`,
        );
    });

    it.each(['linux', 'darwin', 'win32'] as const)(
        'prefers the terminal over SSH on %s',
        async (platform) => {
            const { adapter, nativeWrite, writeToTerminal } = setup(
                { SSH_CONNECTION: '1 2 3 4' },
                { platform },
            );
            await expect(adapter.write('hi')).resolves.toBe('terminal');
            expect(writeToTerminal).toHaveBeenCalledOnce();
            expect(nativeWrite).not.toHaveBeenCalled();
        },
    );

    it('uses the forwarded display over SSH on Linux', async () => {
        const { adapter, nativeWrite, writeToTerminal } = setup({
            SSH_CONNECTION: '1 2 3 4',
            DISPLAY: 'localhost:10.0',
        });
        await expect(adapter.write('hi')).resolves.toBeUndefined();
        expect(nativeWrite).toHaveBeenCalledOnce();
        expect(writeToTerminal).not.toHaveBeenCalled();
    });

    it('flags a missing tool only for a local Linux session', async () => {
        const missing = new MissingClipboardToolError('No clipboard tool found.');
        const make = (platform: NodeJS.Platform, env: NodeJS.ProcessEnv) =>
            createClipboard({
                env,
                platform,
                nativeWrite: vi.fn().mockRejectedValue(missing),
                writeToTerminal: vi.fn().mockReturnValue(true),
            });

        await expect(make('linux', { DISPLAY: ':0' }).write('hi')).resolves.toBe(
            'terminal-no-tool',
        );
        await expect(make('darwin', {}).write('hi')).resolves.toBe('terminal');
        await expect(make('win32', {}).write('hi')).resolves.toBe('terminal');
    });

    it('does not suggest installing a tool when the display itself is missing or failing', async () => {
        const { adapter } = setup({}, { nativeFails: true });
        await expect(adapter.write('hi')).resolves.toBe('terminal');
    });

    it('wraps the terminal sequence for tmux', async () => {
        const { adapter, writeToTerminal } = setup({ SSH_TTY: '/dev/pts/1', TMUX: '/tmp/tmux' });
        await adapter.write('hi');
        const sent = writeToTerminal.mock.calls[0][0] as string;
        expect(sent.startsWith('\u001bPtmux;\u001b\u001b]52;c;')).toBe(true);
        expect(sent.endsWith('\u0007\u001b\\')).toBe(true);
    });

    it('lists the system clipboard reason first, whichever was tried first', async () => {
        const { adapter } = setup(
            { SSH_TTY: '/dev/pts/1' },
            { nativeFails: true, terminal: false },
        );
        const error = await adapter.write('hi').catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(ClipboardUnavailableError);
        expect((error as ClipboardUnavailableError).reasons).toEqual([
            'No clipboard tool found.',
            'No terminal is available to send the copy to.',
        ]);
    });

    it('refuses oversized payloads over the terminal path', async () => {
        const { adapter, writeToTerminal } = setup(
            { SSH_TTY: '/dev/pts/1' },
            { nativeFails: true },
        );
        const error = await adapter
            .write('a'.repeat(OSC52_MAX_BASE64_LENGTH))
            .catch((caught: unknown) => caught);
        expect((error as ClipboardUnavailableError).reasons[1]).toBe(
            'The structure is too large to send through the terminal.',
        );
        expect(writeToTerminal).not.toHaveBeenCalled();
    });
});

describe('terminals that ignore copy requests (VTE, such as GNOME Terminal)', () => {
    const vteReply = async () => 'vte' as const;
    const otherReply = async () => 'other' as const;
    const make = (
        env: NodeJS.ProcessEnv,
        options: {
            platform?: NodeJS.Platform;
            identify?: () => Promise<'vte' | 'other' | undefined>;
            nativeFails?: boolean;
        } = {},
    ) => {
        const writeToTerminal = vi.fn().mockReturnValue(true);
        const nativeWrite = options.nativeFails
            ? vi.fn().mockRejectedValue(new MissingClipboardToolError('No clipboard tool found.'))
            : vi.fn().mockResolvedValue(undefined);
        const adapter = createClipboard({
            env,
            platform: options.platform ?? 'linux',
            nativeWrite,
            writeToTerminal,
            identifyTerminal: options.identify,
        });
        return { adapter, writeToTerminal, nativeWrite };
    };

    it('over SSH, reports up front that a copy cannot work and does not try', async () => {
        const { adapter, writeToTerminal } = make(
            { SSH_TTY: '/dev/pts/1' },
            { identify: vteReply, nativeFails: true },
        );
        const reason = await adapter.unavailableReason?.();
        expect(reason).toContain("can't receive a copy from a remote server");
        expect(reason).toContain('VS Code, Windows Terminal, iTerm2 or kitty');

        const error = await adapter.write('hi').catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(ClipboardUnavailableError);
        expect(writeToTerminal).not.toHaveBeenCalled();
        expect((error as ClipboardUnavailableError).message).not.toContain('install xclip');
    });

    it('over SSH, still copies in a terminal that accepts it', async () => {
        const { adapter, writeToTerminal } = make(
            { SSH_TTY: '/dev/pts/1' },
            { identify: otherReply },
        );
        await expect(adapter.unavailableReason?.()).resolves.toBeUndefined();
        await expect(adapter.write('hi')).resolves.toBe('terminal');
        expect(writeToTerminal).toHaveBeenCalledOnce();
    });

    it('over SSH, an unanswered query keeps the honest "Sent" behaviour', async () => {
        const { adapter } = make({ SSH_TTY: '/dev/pts/1' }, { identify: async () => undefined });
        await expect(adapter.unavailableReason?.()).resolves.toBeUndefined();
        await expect(adapter.write('hi')).resolves.toBe('terminal');
    });

    it('asks the terminal only once', async () => {
        const identify = vi.fn(vteReply);
        const { adapter } = make({ SSH_TTY: '/dev/pts/1' }, { identify });
        await adapter.unavailableReason?.();
        await adapter.write('hi').catch(() => undefined);
        expect(identify).toHaveBeenCalledOnce();
    });

    it('locally, only asks after the system clipboard failed', async () => {
        const identify = vi.fn(vteReply);
        const { adapter } = make({ DISPLAY: ':0' }, { identify });
        await expect(adapter.write('hi')).resolves.toBeUndefined();
        expect(identify).not.toHaveBeenCalled();
    });

    it('locally, with no tool, says the terminal cannot take a copy and keeps the install advice', async () => {
        const { adapter, writeToTerminal } = make(
            { DISPLAY: ':0' },
            { identify: vteReply, nativeFails: true },
        );
        await expect(adapter.unavailableReason?.()).resolves.toBeUndefined();
        const error = (await adapter
            .write('hi')
            .catch((caught: unknown) => caught)) as ClipboardUnavailableError;
        expect(error.reasons).toEqual([
            'No clipboard tool found.',
            "GNOME Terminal and similar terminals can't receive a copy from a program.",
        ]);
        expect(writeToTerminal).not.toHaveBeenCalled();
    });

    it('trusts the terminal over an inherited VTE_VERSION (an IDE started from GNOME Terminal)', async () => {
        const { adapter } = make(
            { DISPLAY: ':0', VTE_VERSION: '7600' },
            { identify: otherReply, nativeFails: true },
        );
        await expect(adapter.write('hi')).resolves.toBe('terminal-no-tool');
    });

    it('falls back to VTE_VERSION only when the terminal does not answer', async () => {
        const noAnswer = async () => undefined;
        const vteEnv = make(
            { DISPLAY: ':0', VTE_VERSION: '7600' },
            { identify: noAnswer, nativeFails: true },
        );
        await expect(vteEnv.adapter.write('hi')).rejects.toBeInstanceOf(ClipboardUnavailableError);

        const vscodeEnv = make(
            { DISPLAY: ':0', VTE_VERSION: '7600', TERM_PROGRAM: 'vscode' },
            { identify: noAnswer, nativeFails: true },
        );
        await expect(vscodeEnv.adapter.write('hi')).resolves.toBe('terminal-no-tool');
    });

    it('does not use the server clipboard of a remote macOS or Windows machine', async () => {
        for (const platform of ['darwin', 'win32'] as const) {
            const { adapter, nativeWrite } = make(
                { SSH_CONNECTION: '1 2 3 4' },
                { platform, identify: vteReply },
            );
            const error = (await adapter
                .write('hi')
                .catch((caught: unknown) => caught)) as ClipboardUnavailableError;
            expect(error.reasons[0]).toBe(
                'This is a remote session, so the system clipboard belongs to the server, not to you.',
            );
            expect(nativeWrite).not.toHaveBeenCalled();
        }
    });
});

describe('reading the clipboard', () => {
    const make = (env: NodeJS.ProcessEnv, nativeRead?: () => Promise<string>) =>
        createClipboard({
            env,
            platform: 'linux',
            nativeWrite: vi.fn(),
            nativeRead,
            writeToTerminal: vi.fn(),
        });

    it('reads the clipboard of a local session', async () => {
        const clipboard = make({ DISPLAY: ':0' }, vi.fn().mockResolvedValue('tree'));
        expect(clipboard.canRead?.()).toBe(true);
        await expect(clipboard.read?.()).resolves.toBe('tree');
    });

    it('cannot read your own clipboard from a remote session', async () => {
        const nativeRead = vi.fn().mockResolvedValue('server clipboard');
        const clipboard = make({ SSH_TTY: '/dev/pts/1' }, nativeRead);
        expect(clipboard.canRead?.()).toBe(false);
        await expect(clipboard.read?.()).rejects.toThrow("can't read your own clipboard");
        expect(nativeRead).not.toHaveBeenCalled();
    });

    it("can read through a forwarded display, which leads to the user's machine", async () => {
        const clipboard = make(
            { SSH_TTY: '/dev/pts/1', DISPLAY: 'localhost:10.0' },
            vi.fn().mockResolvedValue('x'),
        );
        expect(clipboard.canRead?.()).toBe(true);
    });

    it('reports that reading is unavailable when no reader is configured', async () => {
        const clipboard = make({ DISPLAY: ':0' });
        expect(clipboard.canRead?.()).toBe(false);
        await expect(clipboard.read?.()).rejects.toThrow();
    });
});

describe('messages', () => {
    it('confirms a real copy in one line', () => {
        expect(describeCopy('2 entries', undefined)).toBe('Copied 2 entries to the clipboard.');
    });

    it('admits uncertainty after a terminal copy, one idea per line', () => {
        expect(describeCopy('2 entries', 'terminal').split('\n')).toEqual([
            "Sent 2 entries to your terminal's clipboard.",
            'If pasting gives nothing, your terminal may not allow this.',
            'To print it and select by hand: folder-structure-pro export . --output -',
        ]);
    });

    it('suggests installing a tool when one is missing locally', () => {
        expect(describeCopy('2 entries', 'terminal-no-tool').split('\n')).toEqual([
            "Sent 2 entries to your terminal's clipboard.",
            'If pasting gives nothing, install xclip, xsel or wl-clipboard (for example: sudo apt install xclip).',
            'To print it and select by hand: folder-structure-pro export . --output -',
        ]);
    });

    it('lists failure reasons as bullets followed by the file hint', () => {
        const error = new ClipboardUnavailableError(['No clipboard tool found.', 'No terminal.']);
        expect(error.summary).toBe(
            "Couldn't copy to the clipboard.\n- No clipboard tool found.\n- No terminal.",
        );
        expect(error.message).toBe(
            `${error.summary}\nPrint or save it instead: folder-structure-pro export . --output - (or --output tree.txt)`,
        );
    });
});
