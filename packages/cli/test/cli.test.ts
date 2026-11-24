import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FolderFileSystemError } from '@folder-structure-pro/core';
import { NodeFileSystemAdapter } from '../src/adapters/nodeFileSystem.js';
import { CANCELLED, type CliPrompts } from '../src/presentation.js';
import { runCli, runExecutable } from '../src/cli.js';
import { ClipboardUnavailableError } from '../src/adapters/clipboard.js';

let temporaryDirectory: string | undefined;

async function createTemporaryDirectory(): Promise<string> {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-structure-cli-flow-'));
    return temporaryDirectory;
}

afterEach(async () => {
    if (temporaryDirectory) {
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
        temporaryDirectory = undefined;
    }
});

function createPrompts(overrides: Partial<CliPrompts> = {}): CliPrompts {
    return {
        intro: vi.fn(),
        chooseOperation: vi.fn().mockResolvedValue('copy'),
        chooseTarget: vi.fn().mockResolvedValue(''),
        chooseFormat: vi.fn().mockResolvedValue('text'),
        chooseFilters: vi.fn().mockResolvedValue({
            includeHidden: false,
            respectGitignore: true,
        }),
        enterIgnorePatterns: vi.fn().mockResolvedValue(''),
        enterMaxDepth: vi.fn().mockResolvedValue(''),
        chooseDestination: vi.fn().mockResolvedValue('clipboard'),
        enterOutputPath: vi.fn().mockResolvedValue('structure.txt'),
        confirmOverwrite: vi.fn().mockResolvedValue(false),
        chooseCopyFallback: vi.fn().mockResolvedValue('cancel'),
        printContent: vi.fn(),
        chooseStructureSource: vi.fn().mockResolvedValue('file'),
        chooseInvalidStructureAction: vi.fn().mockResolvedValue('cancel'),
        enterStructurePath: vi.fn().mockResolvedValue('folder-structure.txt'),
        enterDestinationDirectory: vi.fn().mockResolvedValue(''),
        chooseFileConflictResolution: vi.fn().mockResolvedValue('skip'),
        confirmStructureCreation: vi.fn().mockResolvedValue(false),
        showPreview: vi.fn(),
        withSpinner: (_message, _done, task) => task(),
        warn: vi.fn(),
        error: vi.fn(),
        cancel: vi.fn(),
        outro: vi.fn(),
        ...overrides,
    };
}

async function createSampleProject(root: string): Promise<void> {
    await fs.writeFile(path.join(root, '.gitignore'), 'ignored.log\n');
    await fs.writeFile(path.join(root, '.env'), 'secret');
    await fs.writeFile(path.join(root, 'visible.ts'), '');
    await fs.writeFile(path.join(root, 'ignored.log'), '');
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.writeFile(path.join(root, 'node_modules', 'dependency.js'), '');
}

describe('CLI interaction', () => {
    it('opens the interactive menu for an argument-free TTY invocation', async () => {
        const cwd = await createTemporaryDirectory();
        const prompts = createPrompts({
            chooseOperation: vi.fn().mockResolvedValue(CANCELLED),
        });

        await expect(
            runExecutable({
                argv: [],
                stdinIsTTY: true,
                stdoutIsTTY: true,
                dependencies: {
                    fileSystem: new NodeFileSystemAdapter(),
                    clipboard: { write: vi.fn() },
                    prompts,
                    cwd,
                },
            }),
        ).resolves.toBe(0);

        expect(prompts.intro).toHaveBeenCalledWith('Folder Structure Pro');
        expect(prompts.cancel).toHaveBeenCalledWith('Operation cancelled.');
    });

    it('uses the current directory by default and preserves extension filtering defaults', async () => {
        const cwd = await createTemporaryDirectory();
        await createSampleProject(cwd);
        const clipboard = { write: vi.fn().mockResolvedValue(undefined) };
        const prompts = createPrompts();

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard,
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        expect(prompts.chooseTarget).toHaveBeenCalledWith(cwd);
        expect(clipboard.write).toHaveBeenCalledOnce();
        const output = clipboard.write.mock.calls[0][0];
        expect(output).toContain('visible.ts');
        expect(output).not.toContain('.env');
        expect(output).not.toContain('ignored.log');
        expect(output).not.toContain('node_modules');
        expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('Copied'));
    });

    it('keeps hidden, explicit, node_modules, and gitignore filtering independent', async () => {
        const cwd = await createTemporaryDirectory();
        await createSampleProject(cwd);
        const clipboard = { write: vi.fn().mockResolvedValue(undefined) };
        const prompts = createPrompts({
            chooseFilters: vi.fn().mockResolvedValue({
                includeHidden: true,
                respectGitignore: true,
            }),
            enterIgnorePatterns: vi.fn().mockResolvedValue('visible.ts'),
        });

        await runCli({
            fileSystem: new NodeFileSystemAdapter(),
            clipboard,
            prompts,
            cwd,
        });

        const output = clipboard.write.mock.calls[0][0];
        expect(output).toContain('.env');
        expect(output).not.toContain('visible.ts');
        expect(output).not.toContain('ignored.log');
        expect(output).not.toContain('node_modules');
    });

    it('can disable gitignore without including hidden entries', async () => {
        const cwd = await createTemporaryDirectory();
        await createSampleProject(cwd);
        const clipboard = { write: vi.fn().mockResolvedValue(undefined) };
        const prompts = createPrompts({
            chooseFilters: vi.fn().mockResolvedValue({
                includeHidden: false,
                respectGitignore: false,
            }),
        });

        await runCli({
            fileSystem: new NodeFileSystemAdapter(),
            clipboard,
            prompts,
            cwd,
        });

        const output = clipboard.write.mock.calls[0][0];
        expect(output).toContain('ignored.log');
        expect(output).not.toContain('.env');
        expect(output).not.toContain('node_modules');
    });

    it('supports JSON formatting and maximum depth through the shared core', async () => {
        const cwd = await createTemporaryDirectory();
        await fs.mkdir(path.join(cwd, 'nested'));
        await fs.writeFile(path.join(cwd, 'nested', 'child.txt'), '');
        const clipboard = { write: vi.fn().mockResolvedValue(undefined) };
        const prompts = createPrompts({
            chooseFormat: vi.fn().mockResolvedValue('json'),
            enterMaxDepth: vi.fn().mockResolvedValue('1'),
        });

        await runCli({
            fileSystem: new NodeFileSystemAdapter(),
            clipboard,
            prompts,
            cwd,
        });

        expect(clipboard.write).toHaveBeenCalledWith(
            JSON.stringify({ [path.basename(cwd)]: { nested: {} } }, null, 2),
        );
    });

    it('rejects a selected symbolic-link directory without resolving it', async () => {
        const cwd = await createTemporaryDirectory();
        const adapter = new NodeFileSystemAdapter();
        vi.spyOn(adapter, 'lstat').mockResolvedValueOnce({
            kind: 'symlink',
            symlink: 'resolved-as-symlink',
        });
        const prompts = createPrompts();

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('NOT_DIRECTORY'));
        expect(prompts.chooseFormat).not.toHaveBeenCalled();
    });

    it.each([
        ['operation', 'chooseOperation'],
        ['target', 'chooseTarget'],
        ['format', 'chooseFormat'],
        ['filters', 'chooseFilters'],
        ['ignore patterns', 'enterIgnorePatterns'],
        ['depth', 'enterMaxDepth'],
        ['destination', 'chooseDestination'],
    ] as const)('handles cancellation at the %s stage', async (_stage, method) => {
        const cwd = await createTemporaryDirectory();
        const clipboard = { write: vi.fn() };
        const prompts = createPrompts({
            [method]: vi.fn().mockResolvedValue(CANCELLED),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard,
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        expect(prompts.cancel).toHaveBeenCalledOnce();
        expect(prompts.outro).not.toHaveBeenCalled();
        expect(clipboard.write).not.toHaveBeenCalled();
    });

    it('reports an invalid target without a stack trace', async () => {
        const cwd = await createTemporaryDirectory();
        const prompts = createPrompts({
            chooseTarget: vi.fn().mockResolvedValue(path.join(cwd, 'missing')),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('NOT_FOUND'));
        expect(prompts.error).not.toHaveBeenCalledWith(expect.stringMatching(/\n\s+at /));
    });

    it('reports unreadable target directories without attempting an output action', async () => {
        const cwd = await createTemporaryDirectory();
        const adapter = new NodeFileSystemAdapter();
        vi.spyOn(adapter, 'readDirectory').mockRejectedValue(
            new FolderFileSystemError('PERMISSION_DENIED', 'Directory access denied.'),
        );
        const prompts = createPrompts();
        const clipboard = { write: vi.fn() };

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard,
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('PERMISSION_DENIED'));
        expect(prompts.outro).not.toHaveBeenCalled();
        expect(clipboard.write).not.toHaveBeenCalled();
    });

    it('does not report clipboard success when clipboard access fails', async () => {
        const cwd = await createTemporaryDirectory();
        const clipboardError = new Error('Clipboard unavailable');
        const prompts = createPrompts();

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn().mockRejectedValue(clipboardError) },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        expect(prompts.error).toHaveBeenCalledWith('Clipboard unavailable');
        expect(prompts.outro).not.toHaveBeenCalled();
    });

    it('exports a new UTF-8 file and confirms before overwriting an existing file', async () => {
        const cwd = await createTemporaryDirectory();
        const newOutputPath = path.join(cwd, 'new.txt');
        const newPrompts = createPrompts({
            chooseDestination: vi.fn().mockResolvedValue('file'),
            enterOutputPath: vi.fn().mockResolvedValue(newOutputPath),
        });
        const adapter = new NodeFileSystemAdapter();

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard: { write: vi.fn() },
                prompts: newPrompts,
                cwd,
            }),
        ).resolves.toBe(0);
        await expect(fs.readFile(newOutputPath, 'utf8')).resolves.toContain('Directory structure:');
        expect(newPrompts.confirmOverwrite).not.toHaveBeenCalled();

        const existingPath = path.join(cwd, 'existing.txt');
        await fs.writeFile(existingPath, 'original');
        const overwritePrompts = createPrompts({
            chooseDestination: vi.fn().mockResolvedValue('file'),
            enterOutputPath: vi.fn().mockResolvedValue(existingPath),
            confirmOverwrite: vi.fn().mockResolvedValue(true),
        });

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard: { write: vi.fn() },
                prompts: overwritePrompts,
                cwd,
            }),
        ).resolves.toBe(0);
        await expect(fs.readFile(existingPath, 'utf8')).resolves.toContain('Directory structure:');
        expect(overwritePrompts.confirmOverwrite).toHaveBeenCalledWith(existingPath);
    });

    it('leaves an existing output unchanged when overwrite is declined', async () => {
        const cwd = await createTemporaryDirectory();
        const existingPath = path.join(cwd, 'existing.txt');
        await fs.writeFile(existingPath, 'original');
        const prompts = createPrompts({
            chooseDestination: vi.fn().mockResolvedValue('file'),
            enterOutputPath: vi.fn().mockResolvedValue(existingPath),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        await expect(fs.readFile(existingPath, 'utf8')).resolves.toBe('original');
        expect(prompts.cancel).toHaveBeenCalledWith(
            'Export cancelled; the existing file was not changed.',
        );
    });

    it('handles cancellation while entering an export path or confirming overwrite', async () => {
        const cwd = await createTemporaryDirectory();
        const pathPrompts = createPrompts({
            chooseDestination: vi.fn().mockResolvedValue('file'),
            enterOutputPath: vi.fn().mockResolvedValue(CANCELLED),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts: pathPrompts,
                cwd,
            }),
        ).resolves.toBe(0);
        expect(pathPrompts.cancel).toHaveBeenCalledOnce();

        const existingPath = path.join(cwd, 'existing.txt');
        await fs.writeFile(existingPath, 'original');
        const confirmationPrompts = createPrompts({
            chooseDestination: vi.fn().mockResolvedValue('file'),
            enterOutputPath: vi.fn().mockResolvedValue(existingPath),
            confirmOverwrite: vi.fn().mockResolvedValue(CANCELLED),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts: confirmationPrompts,
                cwd,
            }),
        ).resolves.toBe(0);
        await expect(fs.readFile(existingPath, 'utf8')).resolves.toBe('original');
        expect(confirmationPrompts.cancel).toHaveBeenCalledOnce();
    });

    it('requires an existing output parent and reports output errors', async () => {
        const cwd = await createTemporaryDirectory();
        const prompts = createPrompts({
            chooseDestination: vi.fn().mockResolvedValue('file'),
            enterOutputPath: vi.fn().mockResolvedValue(path.join(cwd, 'missing', 'file.txt')),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);
        expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('NOT_FOUND'));
        expect(prompts.outro).not.toHaveBeenCalled();
    });

    it('reports an overwrite write failure without claiming success', async () => {
        const cwd = await createTemporaryDirectory();
        const existingPath = path.join(cwd, 'existing.txt');
        await fs.writeFile(existingPath, 'original');
        const adapter = new NodeFileSystemAdapter();
        vi.spyOn(adapter, 'writeText').mockRejectedValue(
            new FolderFileSystemError('PERMISSION_DENIED', 'Write denied.'),
        );
        const prompts = createPrompts({
            chooseDestination: vi.fn().mockResolvedValue('file'),
            enterOutputPath: vi.fn().mockResolvedValue(existingPath),
            confirmOverwrite: vi.fn().mockResolvedValue(true),
        });

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('PERMISSION_DENIED'));
        expect(prompts.outro).not.toHaveBeenCalled();
    });

    it('bounds preview output for large structures', async () => {
        const cwd = await createTemporaryDirectory();
        for (let index = 0; index < 40; index++) {
            await fs.writeFile(path.join(cwd, `file-${index}.txt`), '');
        }
        const prompts = createPrompts();

        await runCli({
            fileSystem: new NodeFileSystemAdapter(),
            clipboard: { write: vi.fn().mockResolvedValue(undefined) },
            prompts,
            cwd,
        });

        const [preview, summary] = vi.mocked(prompts.showPreview).mock.calls[0];
        expect(preview).toContain('preview truncated');
        expect(preview.length).toBeLessThan(1300);
        expect(summary).toContain('40 entries');
    });

    describe('when the clipboard is unavailable', () => {
        async function run(choice: 'print' | 'file' | 'cancel' | typeof CANCELLED) {
            const cwd = await createTemporaryDirectory();
            await createSampleProject(cwd);
            const prompts = createPrompts({
                chooseCopyFallback: vi.fn().mockResolvedValue(choice),
                enterOutputPath: vi.fn().mockResolvedValue('saved.txt'),
            });
            const clipboard = {
                write: vi
                    .fn()
                    .mockRejectedValue(
                        new ClipboardUnavailableError(['xsel missing', 'no terminal']),
                    ),
            };
            const exitCode = await runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard,
                prompts,
                cwd,
            });
            return { cwd, prompts, exitCode };
        }

        it('prints the structure unadorned', async () => {
            const { prompts, exitCode } = await run('print');
            expect(exitCode).toBe(0);
            expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('xsel missing'));
            expect(prompts.printContent).toHaveBeenCalledWith(
                expect.stringContaining('visible.ts'),
            );
            expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('Printed'));
        });

        it('saves to a file and shows how to read it', async () => {
            const { cwd, prompts, exitCode } = await run('file');
            expect(exitCode).toBe(0);
            await expect(fs.readFile(path.join(cwd, 'saved.txt'), 'utf8')).resolves.toContain(
                'visible.ts',
            );
            expect(prompts.outro).toHaveBeenCalledWith(
                expect.stringContaining('View it with: cat'),
            );
        });

        it.each(['cancel', CANCELLED] as const)(
            'exits cleanly when cancelled (%s)',
            async (choice) => {
                const { cwd, prompts, exitCode } = await run(choice);
                expect(exitCode).toBe(0);
                expect(prompts.printContent).not.toHaveBeenCalled();
                expect(prompts.cancel).toHaveBeenCalled();
                await expect(fs.access(path.join(cwd, 'saved.txt'))).rejects.toThrow();
            },
        );

        it('shows an unconfirmed copy as a warning, then only the footer in the outro', async () => {
            const cwd = await createTemporaryDirectory();
            const prompts = createPrompts();
            const exitCode = await runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn().mockResolvedValue('terminal') },
                prompts,
                cwd,
            });
            expect(exitCode).toBe(0);
            expect(prompts.warn).toHaveBeenCalledWith(expect.stringContaining('Sent'));
            expect(prompts.outro).toHaveBeenCalledWith(expect.stringMatching(/^💙/));
        });

        it.each([
            ['an SSH session', { SSH_TTY: '/dev/pts/1' }, true],
            ['a local session', {}, false],
        ])('offers "print here" only when it helps (%s)', async (_label, env, expected) => {
            const cwd = await createTemporaryDirectory();
            const prompts = createPrompts({
                chooseDestination: vi.fn().mockResolvedValue('print'),
            });
            const clipboard = { write: vi.fn() };
            const exitCode = await runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard,
                prompts,
                cwd,
                env,
            });
            expect(exitCode).toBe(0);
            expect(prompts.chooseDestination).toHaveBeenCalledWith({
                offerPrint: expected,
                offerClipboard: true,
            });
            expect(clipboard.write).not.toHaveBeenCalled();
            expect(prompts.printContent).toHaveBeenCalledOnce();
            expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('Printed'));
        });

        it('warns and drops "copy" from the menu when copying is known to be impossible', async () => {
            const cwd = await createTemporaryDirectory();
            const prompts = createPrompts({
                chooseDestination: vi.fn().mockResolvedValue('print'),
            });
            const clipboard = {
                write: vi.fn(),
                unavailableReason: vi
                    .fn()
                    .mockResolvedValue('GNOME Terminal cannot receive a copy.'),
            };
            const exitCode = await runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard,
                prompts,
                cwd,
                env: {},
            });
            expect(exitCode).toBe(0);
            expect(prompts.warn).toHaveBeenCalledWith('GNOME Terminal cannot receive a copy.');
            expect(prompts.chooseDestination).toHaveBeenCalledWith({
                offerPrint: true,
                offerClipboard: false,
            });
            expect(clipboard.write).not.toHaveBeenCalled();
            expect(prompts.printContent).toHaveBeenCalledOnce();
        });

        it('does not offer the menu for unrelated clipboard errors', async () => {
            const cwd = await createTemporaryDirectory();
            const prompts = createPrompts();
            const exitCode = await runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn().mockRejectedValue(new Error('boom')) },
                prompts,
                cwd,
            });
            expect(exitCode).toBe(1);
            expect(prompts.chooseCopyFallback).not.toHaveBeenCalled();
            expect(prompts.error).toHaveBeenCalledWith('boom');
        });
    });
});
