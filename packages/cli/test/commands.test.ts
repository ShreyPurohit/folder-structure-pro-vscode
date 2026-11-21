import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeFileSystemAdapter } from '../src/adapters/nodeFileSystem.js';
import { runExecutable } from '../src/cli.js';
import { formatSuccessFooter } from '../src/success-footer.js';

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-structure-cli-command-'));
    temporaryDirectories.push(directory);
    return directory;
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) => fs.rm(directory, { recursive: true, force: true })),
    );
});

async function runCommand(
    argv: string[],
    cwd: string,
    clipboard = { write: vi.fn().mockResolvedValue(undefined) },
) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runExecutable({
        argv,
        stdinIsTTY: false,
        stdoutIsTTY: false,
        stdout: (text) => {
            stdout.push(text);
        },
        stderr: (text) => {
            stderr.push(text);
        },
        dependencies: {
            fileSystem: new NodeFileSystemAdapter(),
            clipboard,
            cwd,
        },
    });
    return { exitCode, stdout: stdout.join(''), stderr: stderr.join(''), clipboard };
}

const SUCCESS_FOOTER = formatSuccessFooter();

function expectFooterOnce(text: string): void {
    expect(text.split(SUCCESS_FOOTER)).toHaveLength(2);
}

function expectNoFooter(text: string): void {
    expect(text).not.toContain(SUCCESS_FOOTER);
}

describe('direct CLI commands', () => {
    it('runs copy without prompts and reports clipboard failures without changing destinations', async () => {
        const cwd = await createTemporaryDirectory();
        await fs.writeFile(path.join(cwd, 'visible.ts'), '');
        await fs.writeFile(path.join(cwd, '.secret'), '');
        const clipboard = { write: vi.fn().mockResolvedValue(undefined) };

        const result = await runCommand(
            ['copy', '--exclude', 'visible.ts', '--hidden'],
            cwd,
            clipboard,
        );

        expect(result.exitCode).toBe(0);
        expect(clipboard.write).toHaveBeenCalledOnce();
        expect(clipboard.write).toHaveBeenCalledWith(expect.stringContaining('.secret'));
        expect(clipboard.write).not.toHaveBeenCalledWith(expect.stringContaining('visible.ts'));
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('Copied 1 entry to the clipboard.');
        expectFooterOnce(result.stderr);

        const failure = new Error('Clipboard unavailable');
        const failed = await runCommand(['copy'], cwd, {
            write: vi.fn().mockRejectedValue(failure),
        });
        expect(failed.exitCode).toBe(1);
        expect(failed.stderr).toContain('Clipboard unavailable');
        expect(failed.stdout).toBe('');
        expectNoFooter(failed.stderr);
    });

    it('keeps export stdout limited to structure data when --output - is used', async () => {
        const cwd = await createTemporaryDirectory();
        await fs.writeFile(path.join(cwd, 'hello.txt'), '');

        const result = await runCommand(['export', '--output', '-'], cwd);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Directory structure:');
        expect(result.stdout).toContain('hello.txt');
        expect(result.stdout.endsWith('\n')).toBe(true);
        expectNoFooter(result.stdout);
        expectFooterOnce(result.stderr);
    });

    it('requires --force before replacing an exported file', async () => {
        const cwd = await createTemporaryDirectory();
        await fs.writeFile(path.join(cwd, 'hello.txt'), '');
        const outputPath = path.join(cwd, 'structure.txt');
        await fs.writeFile(outputPath, 'keep this');

        const refused = await runCommand(['export', '--output', outputPath], cwd);
        expect(refused.exitCode).toBe(1);
        expect(refused.stderr).toContain('Use --force');
        expectNoFooter(refused.stderr);
        await expect(fs.readFile(outputPath, 'utf8')).resolves.toBe('keep this');

        const replaced = await runCommand(['export', '--output', outputPath, '--force'], cwd);
        expect(replaced.exitCode).toBe(0);
        await expect(fs.readFile(outputPath, 'utf8')).resolves.toContain('hello.txt');
        expect(replaced.stdout).toBe('');
        expect(replaced.stderr).toContain('Exported');
        expectFooterOnce(replaced.stderr);
    });

    it('creates a JSON structure with explicit confirmation and destination', async () => {
        const cwd = await createTemporaryDirectory();
        const destination = path.join(cwd, 'target');
        const input = path.join(cwd, 'structure.json');
        await fs.mkdir(destination);
        await fs.writeFile(input, '{"app":{"index.ts":null}}');

        const result = await runCommand(
            ['create', input, '--format', 'json', '--to', destination, '--yes'],
            cwd,
        );

        expect(result.exitCode).toBe(0);
        await expect(fs.readFile(path.join(destination, 'app', 'index.ts'), 'utf8')).resolves.toBe(
            '',
        );
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('Created 1 directory and 1 file');
        expectFooterOnce(result.stderr);
    });

    it('defaults creation conflicts to fail, while skip preserves and replace requires explicit approval', async () => {
        const cwd = await createTemporaryDirectory();
        const destination = path.join(cwd, 'target');
        const input = path.join(cwd, 'structure.txt');
        await fs.mkdir(path.join(destination, 'app'), { recursive: true });
        await fs.writeFile(path.join(destination, 'app', 'existing.txt'), 'original');
        await fs.writeFile(
            input,
            'Directory structure:\n└── app/\n    ├── existing.txt\n    └── new.txt',
        );

        const failed = await runCommand(
            ['create', input, '--format', 'text', '--to', destination, '--yes'],
            cwd,
        );
        expect(failed.exitCode).toBe(1);
        expect(failed.stderr).toContain('No changes were made');
        expectNoFooter(failed.stderr);
        await expect(
            fs.readFile(path.join(destination, 'app', 'existing.txt'), 'utf8'),
        ).resolves.toBe('original');
        await expect(fs.stat(path.join(destination, 'app', 'new.txt'))).rejects.toMatchObject({
            code: 'ENOENT',
        });

        const skipped = await runCommand(
            [
                'create',
                input,
                '--format',
                'text',
                '--to',
                destination,
                '--yes',
                '--on-conflict',
                'skip',
            ],
            cwd,
        );
        expect(skipped.exitCode).toBe(0);
        await expect(
            fs.readFile(path.join(destination, 'app', 'existing.txt'), 'utf8'),
        ).resolves.toBe('original');
        await expect(fs.readFile(path.join(destination, 'app', 'new.txt'), 'utf8')).resolves.toBe(
            '',
        );
        expect(skipped.stderr).toContain('skipped 1 file');
        expectFooterOnce(skipped.stderr);

        await fs.writeFile(path.join(destination, 'app', 'existing.txt'), 'replace me');
        const replaced = await runCommand(
            [
                'create',
                input,
                '--format',
                'text',
                '--to',
                destination,
                '--yes',
                '--on-conflict',
                'replace',
            ],
            cwd,
        );
        expect(replaced.exitCode).toBe(0);
        await expect(
            fs.readFile(path.join(destination, 'app', 'existing.txt'), 'utf8'),
        ).resolves.toBe('');
        expectFooterOnce(replaced.stderr);

        const missingConfirmation = await runCommand(
            ['create', input, '--format', 'text', '--to', destination, '--on-conflict', 'replace'],
            cwd,
        );
        expect(missingConfirmation.exitCode).toBe(2);
        expect(missingConfirmation.stderr).toContain('requires --yes');
        expectNoFooter(missingConfirmation.stderr);
    });

    it('rejects invalid input and destinations before creating anything', async () => {
        const cwd = await createTemporaryDirectory();
        const destination = path.join(cwd, 'target');
        const invalidInput = path.join(cwd, 'invalid.txt');
        await fs.mkdir(destination);
        await fs.writeFile(invalidInput, 'Directory structure:\n        └── app/');

        const invalid = await runCommand(
            ['create', invalidInput, '--format', 'text', '--to', destination, '--yes'],
            cwd,
        );
        expect(invalid.exitCode).toBe(1);
        expect(invalid.stderr).toContain('Invalid plain-text structure lines');
        expectNoFooter(invalid.stderr);
        await expect(fs.stat(path.join(destination, 'app'))).rejects.toMatchObject({
            code: 'ENOENT',
        });

        const validInput = path.join(cwd, 'valid.json');
        await fs.writeFile(validInput, '{"app":{}}');
        const invalidDestination = await runCommand(
            ['create', validInput, '--format', 'json', '--to', path.join(cwd, 'missing'), '--yes'],
            cwd,
        );
        expect(invalidDestination.exitCode).toBe(1);
        expect(invalidDestination.stderr).toContain('NOT_FOUND');
        expectNoFooter(invalidDestination.stderr);
        await expect(fs.stat(path.join(cwd, 'missing'))).rejects.toMatchObject({
            code: 'ENOENT',
        });
    });

    it('does not prompt for explicit commands and safely rejects non-TTY menu invocation', async () => {
        const cwd = await createTemporaryDirectory();
        const noCommand = await runExecutable({
            argv: [],
            stdinIsTTY: false,
            stdoutIsTTY: false,
            stdout: vi.fn(),
            stderr: vi.fn(),
            dependencies: {
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                cwd,
            },
        });
        expect(noCommand).toBe(2);

        const help = await runCommand(['--help'], cwd);
        expect(help.exitCode).toBe(0);
        expect(help.stdout).toContain('Commands:');
        expectNoFooter(help.stdout);
        expectNoFooter(help.stderr);

        const invalid = await runCommand(['unknown'], cwd);
        expect(invalid.exitCode).toBe(2);
        expect(invalid.stderr).toContain('Unknown command');
        expectNoFooter(invalid.stderr);
    });
});
