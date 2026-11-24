import { spawnSync } from 'node:child_process';
import {
    accessSync,
    constants,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

/**
 * Lets the user paste or type text in their own terminal editor (nano, vim, notepad ...),
 * the way `git commit` does. The editor handles large pastes and blank lines, and works
 * over SSH.
 */
export interface EditorAdapter {
    /** How to save and exit the editor that will open, or undefined when none is available. */
    describe(): string | undefined;
    /** Opens the editor on a temporary file holding `initialText`; resolves with the saved text. */
    edit(initialText: string): Promise<string>;
}

export class EditorUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EditorUnavailableError';
    }
}

interface EditorCommand {
    command: string;
    args: string[];
}

export interface EditorEnvironment {
    env: NodeJS.ProcessEnv;
    platform: NodeJS.Platform;
    /** Whether an executable exists, by name (searched on PATH) or by path. */
    exists(command: string): boolean;
    /** Runs the editor with the terminal handed over to it. */
    run(command: string, args: string[]): { status: number | null; error?: NodeJS.ErrnoException };
    /** Where temporary files go. */
    tempRoot: string;
}

/** Splits a command such as `code --wait` or `"C:\\Program Files\\Editor\\e.exe" -w`. */
export function splitCommand(value: string): string[] {
    const parts: string[] = [];
    let current = '';
    let quote: '"' | "'" | undefined;
    let started = false;
    for (const character of value.trim()) {
        if (quote) {
            if (character === quote) {
                quote = undefined;
            } else {
                current += character;
            }
        } else if (character === '"' || character === "'") {
            quote = character;
            started = true;
        } else if (/\s/.test(character)) {
            if (started || current) {
                parts.push(current);
                current = '';
                started = false;
            }
        } else {
            current += character;
            started = true;
        }
    }
    if (started || current) {
        parts.push(current);
    }
    return parts;
}

function executableExists(command: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform) {
    const extensions =
        platform === 'win32' ? ['', ...(env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')] : [''];
    const directories = path.isAbsolute(command)
        ? ['']
        : (env.PATH ?? '').split(path.delimiter).filter(Boolean);
    for (const directory of directories) {
        for (const extension of extensions) {
            try {
                accessSync(
                    path.join(directory, `${command}${extension}`),
                    platform === 'win32' ? constants.F_OK : constants.X_OK,
                );
                return true;
            } catch {
                // try the next candidate
            }
        }
    }
    return false;
}

/** The user's choice first ($VISUAL, then $EDITOR), then a default that is usually installed. */
export function resolveEditor(environment: EditorEnvironment): EditorCommand | undefined {
    const { env, platform, exists } = environment;
    const fromUser = [env.VISUAL, env.EDITOR]
        .filter((value): value is string => Boolean(value?.trim()))
        .map(splitCommand);
    // `editor` is the Debian and Ubuntu system default. Not `sensible-editor`, which asks the
    // user to choose an editor the first time it runs.
    const defaults = platform === 'win32' ? [['notepad']] : [['editor'], ['nano'], ['vi']];
    for (const [command, ...args] of [...fromUser, ...defaults]) {
        if (command && exists(command)) {
            return { command, args };
        }
    }
    return undefined;
}

function editorName(editor: EditorCommand, environment: EditorEnvironment): string {
    const name = path
        .basename(editor.command)
        .replace(/\.exe$/i, '')
        .toLowerCase();
    if (name !== 'editor') {
        return name;
    }
    // Debian and Ubuntu choose the real editor through /etc/alternatives.
    for (const directory of (environment.env.PATH ?? '').split(path.delimiter)) {
        try {
            return path
                .basename(realpathSync(path.join(directory, 'editor')))
                .replace(/\.(basic|tiny)$/, '')
                .toLowerCase();
        } catch {
            // not in this directory
        }
    }
    return name;
}

export function describeEditor(name: string): string {
    if (name === 'nano' || name === 'pico') {
        return 'Paste your structure, save with Ctrl+O then Enter, and exit with Ctrl+X.';
    }
    if (/^(vi|vim|nvim|view)$/.test(name)) {
        return 'Press i, paste your structure, then press Esc and type :wq followed by Enter to save and exit.';
    }
    if (name === 'notepad') {
        return 'Paste your structure, save with Ctrl+S, and close the window.';
    }
    return 'Paste your structure, then save and close the editor.';
}

export function createEditor(environment: EditorEnvironment): EditorAdapter {
    // Looked up on first use, so commands that never open an editor don't search PATH.
    let resolved: { editor: EditorCommand | undefined } | undefined;
    const getEditor = (): EditorCommand | undefined =>
        (resolved ??= { editor: resolveEditor(environment) }).editor;

    return {
        describe() {
            const editor = getEditor();
            return editor ? describeEditor(editorName(editor, environment)) : undefined;
        },

        async edit(initialText) {
            const editor = getEditor();
            if (!editor) {
                throw new EditorUnavailableError(
                    'No text editor found. Set the EDITOR environment variable, for example: export EDITOR=nano',
                );
            }
            // A private folder and file: the structure may reveal project names.
            const directory = mkdtempSync(path.join(environment.tempRoot, 'folder-structure-pro-'));
            const file = path.join(directory, 'structure.txt');
            try {
                writeFileSync(file, initialText, { mode: 0o600 });
                const { status, error } = environment.run(editor.command, [...editor.args, file]);
                if (error?.code === 'ENOENT') {
                    throw new EditorUnavailableError(
                        `Could not start the editor "${editor.command}".`,
                    );
                }
                if (error) {
                    throw error;
                }
                if (status !== 0) {
                    throw new Error(`The editor exited with code ${status ?? 'unknown'}.`);
                }
                return readFileSync(file, 'utf8');
            } finally {
                rmSync(directory, { recursive: true, force: true });
            }
        },
    };
}

/**
 * Editors such as nano show every non-ASCII character, like the box characters of a folder
 * tree, as escape codes unless the locale is UTF-8. A server often has no UTF-8 locale
 * installed even though the client sent one (LANG=en_US.UTF-8 over SSH), so the system falls
 * back to plain "C". The saved text is still correct, but it looks broken. A locale that
 * already works is left alone.
 */
export function withUtf8Locale(
    env: NodeJS.ProcessEnv,
    platform: NodeJS.Platform,
    charmap: () => string | undefined,
): NodeJS.ProcessEnv {
    if (platform === 'win32') {
        return env;
    }
    const actual = charmap()?.toUpperCase();
    const works =
        actual !== undefined
            ? actual === 'UTF-8' || actual === 'UTF8'
            : /utf-?8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || '');
    if (works) {
        return env;
    }
    return { ...env, LC_ALL: platform === 'darwin' ? 'en_US.UTF-8' : 'C.UTF-8' };
}

/** The character set the system really uses for these settings (`locale charmap`). */
function systemCharmap(): string | undefined {
    const result = spawnSync('locale', ['charmap'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return result.error ? undefined : result.stdout.trim() || undefined;
}

export const systemEditor: EditorAdapter = createEditor({
    env: process.env,
    platform: process.platform,
    exists: (command) => executableExists(command, process.env, process.platform),
    run: (command, args) => {
        const result = spawnSync(command, args, {
            stdio: 'inherit',
            shell: false,
            env: withUtf8Locale(process.env, process.platform, systemCharmap),
        });
        return { status: result.status, error: result.error as NodeJS.ErrnoException | undefined };
    },
    tempRoot: tmpdir(),
});
