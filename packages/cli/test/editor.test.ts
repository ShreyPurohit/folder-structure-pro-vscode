import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    createEditor,
    describeEditor,
    EditorUnavailableError,
    resolveEditor,
    splitCommand,
    withUtf8Locale,
    type EditorEnvironment,
} from '../src/adapters/editor.js';

function environment(overrides: Partial<EditorEnvironment> = {}): EditorEnvironment {
    return {
        env: {},
        platform: 'linux',
        exists: () => true,
        run: () => ({ status: 0 }),
        tempRoot: os.tmpdir(),
        ...overrides,
    };
}

describe('splitCommand', () => {
    it.each([
        ['nano', ['nano']],
        ['code --wait', ['code', '--wait']],
        ['  vim   -u  NONE ', ['vim', '-u', 'NONE']],
        ['"C:\\Program Files\\Editor\\e.exe" -w', ['C:\\Program Files\\Editor\\e.exe', '-w']],
        ["emacs -nw --eval '(setq a 1)'", ['emacs', '-nw', '--eval', '(setq a 1)']],
        ['', []],
    ])('%j', (input, expected) => {
        expect(splitCommand(input)).toEqual(expected);
    });
});

describe('resolveEditor', () => {
    it('prefers $VISUAL, then $EDITOR, then the platform defaults', () => {
        const both = environment({ env: { VISUAL: 'code --wait', EDITOR: 'vim' } });
        expect(resolveEditor(both)).toEqual({ command: 'code', args: ['--wait'] });
        expect(resolveEditor(environment({ env: { EDITOR: 'vim' } }))).toEqual({
            command: 'vim',
            args: [],
        });
        expect(resolveEditor(environment())).toEqual({ command: 'editor', args: [] });
    });

    it('skips editors that are not installed', () => {
        const exists = (command: string) => command === 'nano';
        expect(resolveEditor(environment({ env: { EDITOR: 'missing' }, exists }))).toEqual({
            command: 'nano',
            args: [],
        });
        expect(resolveEditor(environment({ exists: (c) => c === 'vi' }))).toEqual({
            command: 'vi',
            args: [],
        });
    });

    it('uses Notepad on Windows and nothing when no editor exists', () => {
        expect(resolveEditor(environment({ platform: 'win32' }))).toEqual({
            command: 'notepad',
            args: [],
        });
        expect(resolveEditor(environment({ exists: () => false }))).toBeUndefined();
    });
});

describe('describeEditor', () => {
    it('explains how to save and exit in the common editors', () => {
        expect(describeEditor('nano')).toBe(
            'Paste your structure, save with Ctrl+O then Enter, and exit with Ctrl+X.',
        );
        expect(describeEditor('vim')).toContain(':wq');
        expect(describeEditor('notepad')).toContain('Ctrl+S');
        expect(describeEditor('code')).toBe(
            'Paste your structure, then save and close the editor.',
        );
    });

    it('names the editor behind the system default, or stays generic', () => {
        const editor = createEditor(environment({ env: { EDITOR: 'nano' } }));
        expect(editor.describe()).toContain('Ctrl+O');
        expect(createEditor(environment({ exists: () => false })).describe()).toBeUndefined();
    });
});

describe('createEditor', () => {
    it('opens a private temporary file with the starting text and returns what was saved', async () => {
        let seenFile = '';
        let mode = 0;
        const run = vi.fn((_command: string, args: string[]) => {
            seenFile = args.at(-1)!;
            mode = fs.statSync(seenFile).mode & 0o777;
            expect(fs.readFileSync(seenFile, 'utf8')).toBe('start');
            fs.writeFileSync(seenFile, 'Directory structure:\n└── café/');
            return { status: 0 };
        });
        const editor = createEditor(environment({ env: { EDITOR: 'nano' }, run }));

        await expect(editor.edit('start')).resolves.toBe('Directory structure:\n└── café/');
        expect(run).toHaveBeenCalledWith('nano', [seenFile]);
        if (process.platform !== 'win32') {
            expect(mode).toBe(0o600);
        }
        expect(fs.existsSync(seenFile)).toBe(false);
        expect(fs.existsSync(path.dirname(seenFile))).toBe(false);
    });

    it('passes the editor arguments before the file', async () => {
        const run = vi.fn((_command: string, _args: string[]) => ({ status: 0 }));
        await createEditor(environment({ env: { VISUAL: 'code --wait' }, run })).edit('');
        expect(run.mock.calls[0][1].slice(0, 1)).toEqual(['--wait']);
    });

    it('removes the temporary file even when the editor fails', async () => {
        let seenFile = '';
        const run = vi.fn((_c: string, args: string[]) => {
            seenFile = args.at(-1)!;
            return { status: 1 };
        });
        await expect(createEditor(environment({ run })).edit('x')).rejects.toThrow(
            'The editor exited with code 1.',
        );
        expect(fs.existsSync(path.dirname(seenFile))).toBe(false);
    });

    it('reports an editor that cannot be started and a missing editor clearly', async () => {
        const missing = Object.assign(new Error('spawn nano ENOENT'), { code: 'ENOENT' });
        await expect(
            createEditor(environment({ run: () => ({ status: null, error: missing }) })).edit(''),
        ).rejects.toBeInstanceOf(EditorUnavailableError);
        await expect(createEditor(environment({ exists: () => false })).edit('')).rejects.toThrow(
            'Set the EDITOR environment variable',
        );
    });
});

describe('withUtf8Locale', () => {
    it('leaves a locale that already works alone', () => {
        const env = { LANG: 'en_US.UTF-8', PATH: '/bin' };
        expect(withUtf8Locale(env, 'linux', () => 'UTF-8')).toBe(env);
        expect(withUtf8Locale(env, 'linux', () => 'utf8')).toBe(env);
    });

    it('forces a UTF-8 locale when the named one is not installed and the system fell back to C', () => {
        // LANG says UTF-8, but `locale charmap` reports the plain ASCII fallback.
        const env = { LANG: 'en_US.UTF-8', LC_MESSAGES: 'de_DE.UTF-8' };
        expect(withUtf8Locale(env, 'linux', () => 'ANSI_X3.4-1968')).toEqual({
            ...env,
            LC_ALL: 'C.UTF-8',
        });
    });

    it('fixes a plain C locale, and uses a macOS locale name on macOS', () => {
        expect(withUtf8Locale({ LANG: 'C' }, 'linux', () => 'ANSI_X3.4-1968')).toMatchObject({
            LC_ALL: 'C.UTF-8',
        });
        expect(withUtf8Locale({}, 'darwin', () => 'US-ASCII')).toMatchObject({
            LC_ALL: 'en_US.UTF-8',
        });
    });

    it('does not change the original environment', () => {
        const env = { LANG: 'C' };
        withUtf8Locale(env, 'linux', () => 'ANSI_X3.4-1968');
        expect(env).toEqual({ LANG: 'C' });
    });

    it('falls back to reading the variables when the locale tool is unavailable', () => {
        expect(withUtf8Locale({ LANG: 'en_US.UTF-8' }, 'linux', () => undefined)).toEqual({
            LANG: 'en_US.UTF-8',
        });
        expect(withUtf8Locale({ LANG: 'C' }, 'linux', () => undefined)).toMatchObject({
            LC_ALL: 'C.UTF-8',
        });
        expect(
            withUtf8Locale({ LC_ALL: 'POSIX', LANG: 'en_US.UTF-8' }, 'linux', () => undefined),
        ).toMatchObject({
            LC_ALL: 'C.UTF-8',
        });
    });

    it('does nothing on Windows', () => {
        const env = { LANG: 'C' };
        expect(withUtf8Locale(env, 'win32', () => 'ANSI_X3.4-1968')).toBe(env);
    });
});
