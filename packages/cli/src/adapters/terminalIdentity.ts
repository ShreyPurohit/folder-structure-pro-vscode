/**
 * Identifies the user's terminal by asking it, which works through SSH where environment
 * variables such as VTE_VERSION are not forwarded. Only VTE (GNOME Terminal, Tilix, Xfce
 * Terminal and others) is recognised, because it is the common terminal that silently
 * ignores clipboard requests (OSC 52).
 */
export type TerminalKind = 'vte' | 'other';

// Secondary Device Attributes reply: ESC [ > Pp ; Pv ; Pc c
// VTE answers Pp 61 or 65, its version number (for example 7600 for 0.76.0) and Pc 1.
const DEVICE_ATTRIBUTES_REPLY = /\u001b\[>(\d+);(\d+);(\d+)c/;
const MIN_VTE_VERSION = 3500;

export function classifyDeviceAttributes(reply: string): TerminalKind | undefined {
    const match = DEVICE_ATTRIBUTES_REPLY.exec(reply);
    if (!match) {
        return undefined;
    }
    const [, kind, version, extra] = match.map(Number);
    return (kind === 61 || kind === 65) && extra === 1 && version >= MIN_VTE_VERSION
        ? 'vte'
        : 'other';
}

export interface TerminalInput {
    isTTY?: boolean;
    isRaw?: boolean;
    setRawMode?(mode: boolean): unknown;
    on(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
    off(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
    resume(): unknown;
    pause(): unknown;
}

export interface TerminalIo {
    input: TerminalInput;
    /** Writes to the terminal. Returns false when there is no terminal to write to. */
    write(data: string): boolean;
}

/** Long enough for a slow SSH link; terminals that never answer cost this much once. */
export const TERMINAL_QUERY_TIMEOUT_MS = 800;

/**
 * Asks the terminal which program it is. Resolves to undefined when there is no
 * interactive terminal or it does not answer in time. Must not run while a prompt is active.
 */
export function queryTerminalKind(
    io: TerminalIo,
    timeoutMs = TERMINAL_QUERY_TIMEOUT_MS,
): Promise<TerminalKind | undefined> {
    const { input } = io;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
        return Promise.resolve(undefined);
    }

    return new Promise((resolve) => {
        const wasRaw = input.isRaw === true;
        let received = '';
        let finished = false;

        const finish = (kind: TerminalKind | undefined): void => {
            if (finished) {
                return;
            }
            finished = true;
            clearTimeout(timer);
            input.off('data', onData);
            input.setRawMode?.(wasRaw);
            input.pause();
            resolve(kind);
        };
        const onData = (chunk: Buffer | string): void => {
            received += chunk.toString();
            const kind = classifyDeviceAttributes(received);
            if (kind !== undefined) {
                finish(kind);
            }
        };
        const timer = setTimeout(() => finish(undefined), timeoutMs);

        // Raw mode first, so the reply is not echoed onto the screen.
        input.setRawMode?.(true);
        input.on('data', onData);
        input.resume();
        if (!io.write('\u001b[>c')) {
            finish(undefined);
        }
    });
}
