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

describe('messages', () => {
    it('confirms a real copy in one line', () => {
        expect(describeCopy('2 entries', undefined)).toBe('Copied 2 entries to the clipboard.');
    });

    it('admits uncertainty after a terminal copy, one idea per line', () => {
        expect(describeCopy('2 entries', 'terminal').split('\n')).toEqual([
            "Sent 2 entries to your terminal's clipboard.",
            'If pasting gives nothing, your terminal may not allow this.',
            'Save to a file instead: folder-structure-pro export --output tree.txt',
        ]);
    });

    it('suggests installing a tool when one is missing locally', () => {
        expect(describeCopy('2 entries', 'terminal-no-tool').split('\n')).toEqual([
            "Sent 2 entries to your terminal's clipboard.",
            'If pasting gives nothing, install xclip, xsel or wl-clipboard (for example: sudo apt install xclip).',
            'Or save to a file instead: folder-structure-pro export --output tree.txt',
        ]);
    });

    it('lists failure reasons as bullets followed by the file hint', () => {
        const error = new ClipboardUnavailableError(['No clipboard tool found.', 'No terminal.']);
        expect(error.summary).toBe(
            "Couldn't copy to the clipboard.\n- No clipboard tool found.\n- No terminal.",
        );
        expect(error.message).toBe(
            `${error.summary}\nSave to a file instead: folder-structure-pro export --output tree.txt`,
        );
    });
});
