import { spawn } from 'node:child_process';

export interface ClipboardCommand {
    command: string;
    args: string[];
    /** Text encoding the tool expects on stdin. */
    encoding: 'utf8' | 'utf16le-bom';
    env?: Record<string, string>;
    /** Overrides the default time limit; PowerShell can start slowly. */
    timeoutMs?: number;
    /**
     * For tools that must keep running to serve the clipboard (X11 selections belong to the
     * process that set them). The tool prints "ready" once the text is on the clipboard,
     * then is left running in the background, like xclip does.
     */
    background?: boolean;
    /** Exit code meaning "this tool cannot work here", reported like a missing tool. */
    unavailableExitCode?: number;
    /** The tool prints the clipboard text to stdout (used for reading). */
    capture?: boolean;
}

/** Runs a tool with `input` on stdin. Resolves with its stdout when `capture` is set. */
export type RunClipboardCommand = (command: ClipboardCommand, input: Buffer) => Promise<string>;

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

// Prints the clipboard as UTF-8 text. Errors go to stderr as plain text.
const POWERSHELL_READ_SCRIPT =
    "$ErrorActionPreference = 'Stop'; " +
    'try { ' +
    '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false; ' +
    '$text = Get-Clipboard -Raw; ' +
    'if ($null -ne $text) { [Console]::Out.Write($text) } ' +
    '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }';

const GTK_TIMEOUT_MS = 10_000;
const GTK_UNAVAILABLE_EXIT_CODE = 3;

// Last resort for Linux desktops with no xclip, xsel or wl-copy (for example a fresh
// Ubuntu): Python 3 and GTK 3 ship with most desktops. Runs until another program takes
// over the clipboard, the way xclip does.
// Both GTK scripts start the same way: exit code 3 when Python or GTK is missing, 4 when
// there is no display.
const GTK_PREAMBLE = [
    'import sys',
    'try:',
    '    import gi',
    "    gi.require_version('Gtk', '3.0')",
    "    gi.require_version('Gdk', '3.0')",
    '    from gi.repository import Gtk, Gdk',
    'except Exception:',
    `    sys.exit(${GTK_UNAVAILABLE_EXIT_CODE})`,
    'if not Gtk.init_check()[0]:',
    "    sys.stderr.write('Cannot open the display.\\n')",
    '    sys.exit(4)',
];

const GTK_SCRIPT = [
    ...GTK_PREAMBLE,
    "text = sys.stdin.buffer.read().decode('utf-8')",
    'clipboard = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)',
    'clipboard.set_text(text, -1)',
    'clipboard.store()',
    'ignore_own_change = [True]',
    'def on_owner_change(*_):',
    '    if ignore_own_change[0]:',
    '        ignore_own_change[0] = False',
    '        return',
    '    Gtk.main_quit()',
    "clipboard.connect('owner-change', on_owner_change)",
    "sys.stdout.write('ready\\n')",
    'sys.stdout.flush()',
    'Gtk.main()',
].join('\n');

const GTK_READ_SCRIPT = [
    ...GTK_PREAMBLE,
    'text = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD).wait_for_text()',
    "sys.stdout.buffer.write((text or '').encode('utf-8'))",
].join('\n');

function windowsReadCommands(): ClipboardCommand[] {
    const powershell = (command: string): ClipboardCommand => ({
        command,
        args: ['-NoProfile', '-NonInteractive', '-Command', POWERSHELL_READ_SCRIPT],
        encoding: 'utf8',
        capture: true,
        timeoutMs: POWERSHELL_TIMEOUT_MS,
    });
    return [powershell('powershell.exe'), powershell('pwsh')];
}

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
            {
                command: 'python3',
                args: ['-c', GTK_SCRIPT],
                encoding: 'utf8',
                background: true,
                timeoutMs: GTK_TIMEOUT_MS,
                unavailableExitCode: GTK_UNAVAILABLE_EXIT_CODE,
                // GTK would otherwise pick Wayland, where a program with no window may be refused.
                env: { GDK_BACKEND: 'x11' },
            },
        );
    }
    return commands;
}

/** Lists the tools that can read the clipboard on this system, best first. */
export function getClipboardReadCommands(
    platform: NodeJS.Platform,
    env: NodeJS.ProcessEnv,
): ClipboardCommand[] {
    const reader = (
        command: string,
        args: string[],
        extra: Partial<ClipboardCommand> = {},
    ): ClipboardCommand => ({ command, args, encoding: 'utf8', capture: true, ...extra });

    if (platform === 'darwin') {
        return [reader('pbpaste', [], { env: { LC_CTYPE: 'UTF-8' } })];
    }
    if (platform === 'win32') {
        return windowsReadCommands();
    }
    if (platform !== 'linux') {
        return [];
    }

    const commands: ClipboardCommand[] = [];
    if (isWsl(env)) {
        commands.push(...windowsReadCommands());
    }
    if (env.TERMUX_VERSION) {
        commands.push(reader('termux-clipboard-get', []));
    }
    if (env.WAYLAND_DISPLAY) {
        commands.push(reader('wl-paste', ['--no-newline']));
    }
    if (env.DISPLAY) {
        commands.push(
            reader('xclip', ['-selection', 'clipboard', '-out']),
            reader('xsel', ['--clipboard', '--output']),
            reader('python3', ['-c', GTK_READ_SCRIPT], {
                timeoutMs: GTK_TIMEOUT_MS,
                unavailableExitCode: GTK_UNAVAILABLE_EXIT_CODE,
                env: { GDK_BACKEND: 'x11' },
            }),
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
        const background = clipboardCommand.background === true;
        const capture = clipboardCommand.capture === true;
        const child = spawn(clipboardCommand.command, clipboardCommand.args, {
            shell: false,
            stdio: ['pipe', background || capture ? 'pipe' : 'ignore', 'pipe'],
            detached: background,
            env: { ...process.env, ...clipboardCommand.env },
            windowsHide: true,
        });
        let stderr = '';
        let stdout = '';
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
                return;
            }
            if (background) {
                // Leave the tool running to serve the clipboard, without keeping Node alive.
                child.stdout?.destroy();
                child.stdin?.destroy();
                child.unref();
            }
            resolve(capture ? stdout : '');
        };
        const timer = setTimeout(() => {
            child.kill();
            settle(new Error('it did not respond in time'));
        }, clipboardCommand.timeoutMs ?? DEFAULT_TIMEOUT_MS);

        child.stderr?.setEncoding('utf8');
        child.stderr?.on('data', (chunk: string) => {
            stderr += chunk;
        });
        if (background || capture) {
            child.stdout?.setEncoding('utf8');
            child.stdout?.on('data', (chunk: string) => {
                stdout += chunk;
                if (background && stdout.includes('ready')) {
                    settle();
                }
            });
        }
        child.stdin?.on('error', () => undefined); // the tool may exit before reading everything
        child.on('error', (error: NodeJS.ErrnoException) => {
            settle(new Error(error.code === 'ENOENT' ? NOT_FOUND : error.message));
        });
        // Reading tools exit after printing, so wait for 'close' to be sure all output arrived.
        const onFinished = (code: number | null): void => {
            if (background && code === 0 && !settled) {
                settle(new Error('it exited before the copy finished'));
            } else if (code === clipboardCommand.unavailableExitCode) {
                settle(new Error(NOT_FOUND));
            } else {
                settle(
                    code === 0
                        ? undefined
                        : new Error(stderr.trim().split('\n')[0] || `it exited with code ${code}`),
                );
            }
        };
        child.on(capture ? 'close' : 'exit', onFinished);
        child.stdin?.end(input);
    });

/** Thrown when none of the platform's clipboard tools are installed. */
export class MissingClipboardToolError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MissingClipboardToolError';
    }
}

function describeMissingTools(
    platform: NodeJS.Platform,
    commands: ClipboardCommand[],
    env: NodeJS.ProcessEnv,
): string {
    if (env.TERMUX_VERSION || env.PREFIX?.includes('com.termux')) {
        return 'Clipboard unavailable. Install Termux:API and the termux-api package to enable clipboard access.';
    }

    if (platform === 'linux') {
        return 'No clipboard tool found. Install xclip, xsel or wl-clipboard (for example: sudo apt install xclip).';
    }

    if (platform === 'win32') {
        return 'Neither PowerShell nor clip.exe could be started.';
    }

    return `${commands[0].command} was not found.`;
}

function describeNoCommands(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
    return platform !== 'linux'
        ? 'This operating system has no supported clipboard tool.'
        : isRemoteSession(env)
          ? 'This server has no desktop session, so it has no clipboard.'
          : 'No desktop session found (DISPLAY and WAYLAND_DISPLAY are not set).';
}

/**
 * Runs the first tool that works and returns its output (empty for tools that only write).
 * Rejects with a short, human-readable reason (possibly several sentences) if none work.
 */
async function runFirstWorking(
    commands: ClipboardCommand[],
    platform: NodeJS.Platform,
    env: NodeJS.ProcessEnv,
    run: RunClipboardCommand,
    inputFor: (command: ClipboardCommand) => Buffer,
): Promise<string> {
    if (commands.length === 0) {
        throw new Error(describeNoCommands(platform, env));
    }

    const failures: Array<{ command: string; reason: string }> = [];
    for (const command of commands) {
        try {
            return await run(command, inputFor(command));
        } catch (error) {
            failures.push({
                command: command.command,
                reason: error instanceof Error ? error.message : String(error),
            });
        }
    }

    if (failures.every((failure) => failure.reason === NOT_FOUND)) {
        throw new MissingClipboardToolError(describeMissingTools(platform, commands, env));
    }
    throw new Error(
        failures
            .filter((failure) => failure.reason !== NOT_FOUND)
            .map((failure) => `${failure.command} failed: ${failure.reason}`)
            .join('; '),
    );
}

/** Copies text with the first working platform tool. */
export async function writeNativeClipboard(
    text: string,
    platform: NodeJS.Platform,
    env: NodeJS.ProcessEnv,
    run: RunClipboardCommand = runClipboardCommand,
): Promise<void> {
    await runFirstWorking(getClipboardCommands(platform, env), platform, env, run, (command) =>
        encodeInput(text, command.encoding),
    );
}

/** Reads the clipboard text with the first working platform tool ('' when it holds no text). */
export function readNativeClipboard(
    platform: NodeJS.Platform,
    env: NodeJS.ProcessEnv,
    run: RunClipboardCommand = runClipboardCommand,
): Promise<string> {
    return runFirstWorking(getClipboardReadCommands(platform, env), platform, env, run, () =>
        Buffer.alloc(0),
    );
}
