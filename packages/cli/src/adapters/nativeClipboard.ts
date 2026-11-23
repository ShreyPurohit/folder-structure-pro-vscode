import { spawn } from 'node:child_process';

export interface ClipboardCommand {
    command: string;
    args: string[];
    /** Text encoding the tool expects on stdin. */
    encoding: 'utf8' | 'utf16le-bom';
    env?: Record<string, string>;
    /** Overrides the default time limit; PowerShell can start slowly. */
    timeoutMs?: number;
}

export type RunClipboardCommand = (command: ClipboardCommand, input: Buffer) => Promise<void>;

const DEFAULT_TIMEOUT_MS = 5_000;
const POWERSHELL_TIMEOUT_MS = 20_000;
const NOT_FOUND = 'not found';

// Reads stdin as raw bytes and decodes them as UTF-8, so file names with accents or other
// non-ASCII characters survive. Errors go to stderr as plain text (not PowerShell's XML).
const POWERSHELL_SCRIPT =
    "$ErrorActionPreference = 'Stop'; " +
    'try { ' +
    '$buffer = New-Object System.IO.MemoryStream; ' +
    '[Console]::OpenStandardInput().CopyTo($buffer); ' +
    'Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString($buffer.ToArray())) ' +
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }';

function windowsCommands(): ClipboardCommand[] {
    const powershell = (command: string): ClipboardCommand => ({
        command,
        args: ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_SCRIPT],
        encoding: 'utf8',
        timeoutMs: POWERSHELL_TIMEOUT_MS,
    });
    return [
        powershell('powershell.exe'),
        powershell('pwsh'),
        // clip.exe decodes stdin as UTF-16 only when it starts with a byte order mark.
        { command: 'clip.exe', args: [], encoding: 'utf16le-bom' },
    ];
}

export function isRemoteSession(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env.SSH_TTY || env.SSH_CONNECTION || env.SSH_CLIENT);
}

function isWsl(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP);
}

/** True when a Linux graphical session (local, or forwarded over SSH) is available. */
export function hasLinuxDisplay(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

/** Lists the clipboard tools worth trying on this system, best first. */
export function getClipboardCommands(
    platform: NodeJS.Platform,
    env: NodeJS.ProcessEnv,
): ClipboardCommand[] {
    if (platform === 'darwin') {
        // pbcopy honours the locale; without this, non-ASCII text is mangled under LANG=C.
        return [{ command: 'pbcopy', args: [], encoding: 'utf8', env: { LC_CTYPE: 'UTF-8' } }];
    }
    if (platform === 'win32') {
        return windowsCommands();
    }
    if (platform !== 'linux') {
        return [];
    }

    const commands: ClipboardCommand[] = [];
    if (isWsl(env)) {
        commands.push(...windowsCommands());
    }
    if (env.TERMUX_VERSION) {
        commands.push({ command: 'termux-clipboard-set', args: [], encoding: 'utf8' });
    }
    if (env.WAYLAND_DISPLAY) {
        commands.push({ command: 'wl-copy', args: [], encoding: 'utf8' });
    }
    if (env.DISPLAY) {
        commands.push(
            { command: 'xclip', args: ['-selection', 'clipboard', '-in'], encoding: 'utf8' },
            { command: 'xsel', args: ['--clipboard', '--input'], encoding: 'utf8' },
        );
    }
    return commands;
}

function encodeInput(text: string, encoding: ClipboardCommand['encoding']): Buffer {
    return encoding === 'utf16le-bom'
        ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
        : Buffer.from(text, 'utf8');
}

export const runClipboardCommand: RunClipboardCommand = (clipboardCommand, input) =>
    new Promise((resolve, reject) => {
        // Only 'exit' is awaited, never 'close': xclip, xsel and wl-copy fork a background
        // process that keeps serving the selection and holds the inherited pipes open.
        const child = spawn(clipboardCommand.command, clipboardCommand.args, {
            shell: false,
            stdio: ['pipe', 'ignore', 'pipe'],
            env: { ...process.env, ...clipboardCommand.env },
            windowsHide: true,
        });
        let stderr = '';
        let settled = false;
        const settle = (error?: Error): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            child.stderr?.destroy();
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };
        const timer = setTimeout(() => {
            child.kill();
            settle(new Error('it did not respond in time'));
        }, clipboardCommand.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        child.stderr?.setEncoding('utf8');
        child.stderr?.on('data', (chunk: string) => {
            stderr += chunk;
        });
        child.stdin?.on('error', () => undefined); // the tool may exit before reading everything
        child.on('error', (error: NodeJS.ErrnoException) => {
            settle(new Error(error.code === 'ENOENT' ? NOT_FOUND : error.message));
        });
        child.on('exit', (code) => {
            settle(
                code === 0
                    ? undefined
                    : new Error(stderr.trim().split('\n')[0] || `it exited with code ${code}`),
            );
        });
        child.stdin?.end(input);
    });

/** Thrown when none of the platform's clipboard tools are installed. */
export class MissingClipboardToolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MissingClipboardToolError';
    }
}

function describeMissingTools(platform: NodeJS.Platform, commands: ClipboardCommand[]): string {
    if (platform === 'linux') {
        return 'No clipboard tool found. Install xclip, xsel or wl-clipboard (for example: sudo apt install xclip).';
    }
    if (platform === 'win32') {
        return 'Neither PowerShell nor clip.exe could be started.';
    }
    if (process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux')) {
        return 'Clipboard unavailable. Install Termux:API and the termux-api package to enable clipboard access.';
    }
    return `${commands[0].command} was not found.`;
}

/**
 * Copies text with the first working platform tool.
 * Rejects with a short, human-readable reason (possibly several sentences) if none work.
 */
export async function writeNativeClipboard(
    text: string,
    platform: NodeJS.Platform,
    env: NodeJS.ProcessEnv,
    run: RunClipboardCommand = runClipboardCommand,
): Promise<void> {
    const commands = getClipboardCommands(platform, env);
    if (commands.length === 0) {
        throw new Error(
            platform !== 'linux'
                ? 'This operating system has no supported clipboard tool.'
                : isRemoteSession(env)
                  ? 'This server has no desktop session, so it has no clipboard.'
                  : 'No desktop session found (DISPLAY and WAYLAND_DISPLAY are not set).',
        );
    }

    const failures: Array<{ command: string; reason: string }> = [];
    for (const command of commands) {
        try {
            await run(command, encodeInput(text, command.encoding));
            return;
        } catch (error) {
            failures.push({
                command: command.command,
                reason: error instanceof Error ? error.message : String(error),
            });
        }
    }

    if (failures.every((failure) => failure.reason === NOT_FOUND)) {
        throw new MissingClipboardToolError(describeMissingTools(platform, commands));
    }
    throw new Error(
        failures
            .filter((failure) => failure.reason !== NOT_FOUND)
            .map((failure) => `${failure.command} failed: ${failure.reason}`)
            .join('; '),
    );
}
