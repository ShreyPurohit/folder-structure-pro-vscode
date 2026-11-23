import fs from 'node:fs';
import {
    hasLinuxDisplay,
    isRemoteSession,
    MissingClipboardToolError,
    writeNativeClipboard,
} from './nativeClipboard.js';

/**
 * How a successful copy was done when it could not be confirmed:
 * 'terminal' hands the text to the user's terminal (OSC 52);
 * 'terminal-no-tool' is the same, after a local Linux session had no clipboard tool installed.
 */
export type UnconfirmedCopy = 'terminal' | 'terminal-no-tool';

export interface ClipboardAdapter {
    /** Resolves to a value only when the copy could not be confirmed. */
    write(text: string): Promise<UnconfirmedCopy | void>;
}

const SAVE_HINT = 'Save to a file instead: folder-structure-pro export --output tree.txt';

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
    return method === 'terminal-no-tool'
        ? [
              sent,
              'If pasting gives nothing, install xclip, xsel or wl-clipboard (for example: sudo apt install xclip).',
              'Or save to a file instead: folder-structure-pro export --output tree.txt',
          ].join('\n')
        : [sent, 'If pasting gives nothing, your terminal may not allow this.', SAVE_HINT].join(
              '\n',
          );
}

/** Largest base64 payload sent through OSC 52; many terminals drop longer sequences. */
export const OSC52_MAX_BASE64_LENGTH = 100_000;

export interface ClipboardEnvironment {
    env: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
    nativeWrite(text: string): Promise<void>;
    /** Writes raw terminal bytes to the controlling terminal. Returns false if none is available. */
    writeToTerminal(data: string): boolean;
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
    const { env, platform, nativeWrite, writeToTerminal } = environment;

    const copyWithOsc52 = (text: string): void => {
        const sequence = buildOsc52Sequence(text, env);
        if (!writeToTerminal(sequence)) {
            throw new Error('No terminal is available to send the copy to.');
        }
    };

    return {
        async write(text) {
            // Over SSH the system clipboard belongs to the server, not to the user's machine,
            // so ask the user's own terminal first. The exception is a forwarded X11 or
            // Wayland display on Linux, which does lead back to the user's machine.
            const terminalFirst =
                isRemoteSession(env) && !(platform === 'linux' && hasLinuxDisplay(env));

            let nativeFailure: Error | undefined;
            let terminalFailure: Error | undefined;

            const tryNative = async (): Promise<boolean> => {
                try {
                    await nativeWrite(text);
                    return true;
                } catch (error) {
                    nativeFailure = error instanceof Error ? error : new Error(String(error));
                    return false;
                }
            };
            const tryTerminal = (): boolean => {
                try {
                    copyWithOsc52(text);
                    return true;
                } catch (error) {
                    terminalFailure = error instanceof Error ? error : new Error(String(error));
                    return false;
                }
            };

            if (terminalFirst) {
                if (tryTerminal()) {
                    return 'terminal';
                }
                if (await tryNative()) {
                    return;
                }
            } else {
                if (await tryNative()) {
                    return;
                }
                if (tryTerminal()) {
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
    writeToTerminal: writeToControllingTerminal,
});
