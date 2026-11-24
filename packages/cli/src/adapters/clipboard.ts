import fs from 'node:fs';
import {
    hasLinuxDisplay,
    isRemoteSession,
    MissingClipboardToolError,
    readNativeClipboard,
    writeNativeClipboard,
} from './nativeClipboard.js';
import { queryTerminalKind, type TerminalKind } from './terminalIdentity.js';

/**
 * How a successful copy was done when it could not be confirmed:
 * 'terminal' hands the text to the user's terminal (OSC 52);
 * 'terminal-no-tool' is the same, after a local Linux session had no clipboard tool installed.
 */
export type UnconfirmedCopy = 'terminal' | 'terminal-no-tool';

export interface ClipboardAdapter {
    /** Resolves to a value only when the copy could not be confirmed. */
    write(text: string): Promise<UnconfirmedCopy | void>;
    /**
     * A reason why copying is known to be impossible here, found before trying
     * (for example GNOME Terminal over SSH), or undefined when a copy may work.
     */
    unavailableReason?(): Promise<string | undefined>;
    /** Whether this session can read the user's own clipboard (not in a remote session). */
    canRead?(): boolean;
    /** Reads the clipboard text; '' when it holds no text. */
    read?(): Promise<string>;
}

const SAVE_HINT =
    'Print or save it instead: folder-structure-pro export . --output - (or --output tree.txt)';
const PRINT_HINT = 'To print it and select by hand: folder-structure-pro export . --output -';

/** Thrown when no clipboard route worked, so callers can offer another way to get the text out. */
export class ClipboardUnavailableError extends Error {
    /** The headline and one bullet per reason, without the trailing hint. */
    readonly summary: string;

    constructor(readonly reasons: string[]) {
        const summary = [
            "Couldn't copy to the clipboard.",
            ...reasons.map((reason) => `- ${reason}`),
        ].join('\n');
        super(`${summary}\n${SAVE_HINT}`);
        this.name = 'ClipboardUnavailableError';
        this.summary = summary;
    }
}

/** Builds the success message; admits uncertainty when the copy could not be confirmed. */
export function describeCopy(entries: string, method: UnconfirmedCopy | void): string {
    if (method === undefined) {
        return `Copied ${entries} to the clipboard.`;
    }
    const sent = `Sent ${entries} to your terminal's clipboard.`;
    const advice =
        method === 'terminal-no-tool'
            ? 'If pasting gives nothing, install xclip, xsel or wl-clipboard (for example: sudo apt install xclip).'
            : 'If pasting gives nothing, your terminal may not allow this.';
    return [sent, advice, PRINT_HINT].join('\n');
}

const VTE_LOCAL_REASON =
    "GNOME Terminal and similar terminals can't receive a copy from a program.";
const VTE_REMOTE_REASON =
    "GNOME Terminal and similar terminals can't receive a copy from a remote server. Use another terminal, such as VS Code, Windows Terminal, iTerm2 or kitty.";
const REMOTE_READ_REASON =
    "A remote session can't read your own clipboard. Open an editor or choose a file instead.";
const REMOTE_CLIPBOARD_REASON =
    'This is a remote session, so the system clipboard belongs to the server, not to you.';

/** Largest base64 payload sent through OSC 52; many terminals drop longer sequences. */
export const OSC52_MAX_BASE64_LENGTH = 100_000;

export interface ClipboardEnvironment {
    env: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
    nativeWrite(text: string): Promise<void>;
    nativeRead?(): Promise<string>;
    /** Writes raw terminal bytes to the controlling terminal. Returns false if none is available. */
    writeToTerminal(data: string): boolean;
    /** Asks the terminal which program it is. Only called once the terminal route is needed. */
    identifyTerminal?(): Promise<TerminalKind | undefined>;
}

function buildOsc52Sequence(text: string, env: NodeJS.ProcessEnv): string {
    const payload = Buffer.from(text, 'utf8').toString('base64');
    if (payload.length > OSC52_MAX_BASE64_LENGTH) {
        throw new Error('The structure is too large to send through the terminal.');
    }
    const sequence = `\u001b]52;c;${payload}\u0007`;
    // tmux only forwards OSC 52 to the outer terminal when wrapped in a passthrough sequence.
    return env.TMUX
        ? `\u001bPtmux;${sequence.replaceAll('\u001b', '\u001b\u001b')}\u001b\\`
        : sequence;
}

export function createClipboard(environment: ClipboardEnvironment): ClipboardAdapter {
    const { env, platform, nativeWrite, nativeRead, writeToTerminal, identifyTerminal } =
        environment;

    // Over SSH the system clipboard belongs to the server, not to the user's machine, so the
    // user's own terminal comes first. The exception is a forwarded X11 or Wayland display
    // on Linux, which does lead back to the user's machine.
    const remote = isRemoteSession(env);
    const terminalFirst = remote && !(platform === 'linux' && hasLinuxDisplay(env));

    const copyWithOsc52 = (text: string): void => {
        const sequence = buildOsc52Sequence(text, env);
        if (!writeToTerminal(sequence)) {
            throw new Error('No terminal is available to send the copy to.');
        }
    };

    // VTE (GNOME Terminal and others) silently ignores copy requests. The terminal's own
    // answer decides; VTE_VERSION is only a fallback, because it can be inherited by another
    // terminal started from a GNOME Terminal (an IDE, for example).
    let vte: Promise<boolean> | undefined;
    const isVte = (): Promise<boolean> => {
        vte ??= (async () => {
            const kind = await identifyTerminal?.();
            if (kind !== undefined) {
                return kind === 'vte';
            }
            return Boolean(env.VTE_VERSION) && env.TERM_PROGRAM !== 'vscode';
        })();
        return vte;
    };

    return {
        canRead: () => !terminalFirst && nativeRead !== undefined,

        async read() {
            if (terminalFirst || nativeRead === undefined) {
                throw new Error(REMOTE_READ_REASON);
            }
            return nativeRead();
        },

        async unavailableReason() {
            return terminalFirst && (await isVte()) ? VTE_REMOTE_REASON : undefined;
        },

        async write(text) {
            let nativeFailure: Error | undefined;
            let terminalFailure: Error | undefined;

            const tryNative = async (): Promise<boolean> => {
                if (terminalFirst && platform !== 'linux') {
                    nativeFailure = new Error(REMOTE_CLIPBOARD_REASON);
                    return false;
                }
                try {
                    await nativeWrite(text);
                    return true;
                } catch (error) {
                    nativeFailure = error instanceof Error ? error : new Error(String(error));
                    return false;
                }
            };
            const tryTerminal = async (): Promise<boolean> => {
                if (await isVte()) {
                    terminalFailure = new Error(remote ? VTE_REMOTE_REASON : VTE_LOCAL_REASON);
                    return false;
                }
                try {
                    copyWithOsc52(text);
                    return true;
                } catch (error) {
                    terminalFailure = error instanceof Error ? error : new Error(String(error));
                    return false;
                }
            };

            if (terminalFirst) {
                if (await tryTerminal()) {
                    return 'terminal';
                }
                if (await tryNative()) {
                    return;
                }
            } else {
                if (await tryNative()) {
                    return;
                }
                if (await tryTerminal()) {
                    // A missing tool on a local Linux desktop is something the user can fix.
                    return platform === 'linux' &&
                        nativeFailure instanceof MissingClipboardToolError
                        ? 'terminal-no-tool'
                        : 'terminal';
                }
            }

            throw new ClipboardUnavailableError(
                [nativeFailure, terminalFailure].flatMap((failure) =>
                    failure ? [failure.message] : [],
                ),
            );
        },
    };
}

function writeToControllingTerminal(data: string): boolean {
    if (process.platform !== 'win32') {
        try {
            const fd = fs.openSync('/dev/tty', 'w');
            try {
                fs.writeSync(fd, data);
            } finally {
                fs.closeSync(fd);
            }
            return true;
        } catch {
            // fall through to stdio
        }
    }
    const stream = process.stderr.isTTY
        ? process.stderr
        : process.stdout.isTTY
          ? process.stdout
          : undefined;
    if (!stream) {
        return false;
    }
    stream.write(data);
    return true;
}

export const systemClipboard: ClipboardAdapter = createClipboard({
    env: process.env,
    platform: process.platform,
    nativeWrite: (text) => writeNativeClipboard(text, process.platform, process.env),
    nativeRead: () => readNativeClipboard(process.platform, process.env),
    writeToTerminal: writeToControllingTerminal,
    identifyTerminal: () =>
        queryTerminalKind({
            input: process.stdin,
            write: (data) => process.stdout.isTTY === true && process.stdout.write(data),
        }),
});
