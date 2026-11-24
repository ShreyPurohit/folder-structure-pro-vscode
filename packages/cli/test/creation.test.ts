import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorUnavailableError, type EditorAdapter } from '../src/adapters/editor.js';
import { NodeFileSystemAdapter } from '../src/adapters/nodeFileSystem.js';
import { CANCELLED, type CliPrompts } from '../src/presentation.js';
import { runCli } from '../src/cli.js';

let temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-structure-create-'));
    temporaryDirectories.push(directory);
    return directory;
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })),
    );
    temporaryDirectories = [];
    vi.restoreAllMocks();
});

function createPrompts(overrides: Partial<CliPrompts> = {}): CliPrompts {
    return {
        intro: vi.fn(),
        chooseOperation: vi.fn().mockResolvedValue('create'),
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
        enterStructurePath: vi.fn().mockResolvedValue('structure.txt'),
        enterDestinationDirectory: vi.fn().mockResolvedValue('destination'),
        chooseFileConflictResolution: vi.fn().mockResolvedValue('skip'),
        confirmStructureCreation: vi.fn().mockResolvedValue(true),
        showPreview: vi.fn(),
        withSpinner: (_message, _done, task) => task(),
        warn: vi.fn(),
        error: vi.fn(),
        cancel: vi.fn(),
        outro: vi.fn(),
        ...overrides,
    };
}

async function createProject(root: string, structure: string): Promise<string> {
    const inputPath = path.join(root, 'structure.txt');
    await fs.writeFile(inputPath, structure, 'utf8');
    await fs.mkdir(path.join(root, 'destination'));
    return inputPath;
}

describe('CLI structure creation', () => {
    it('creates a plain-text tree using the shared parser', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = await createProject(
            cwd,
            `Directory structure:
└── app/
    ├── index.ts
    └── README`,
        );
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        const destination = path.join(cwd, 'destination');
        await expect(fs.readFile(path.join(destination, 'app', 'index.ts'), 'utf8')).resolves.toBe(
            '',
        );
        await expect(fs.readFile(path.join(destination, 'app', 'README'), 'utf8')).resolves.toBe(
            '',
        );
        expect(prompts.showPreview).toHaveBeenCalledWith(
            expect.stringContaining('[create] app/'),
            expect.stringContaining('1 directories to create'),
        );
        expect(prompts.outro).toHaveBeenCalledWith(
            expect.stringContaining('Created 1 directory and 2 files'),
        );
    });

    it('creates a JSON tree and honors the current directory destination default', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = path.join(cwd, 'structure.json');
        await fs.writeFile(inputPath, '{"app":{"index":"ts"}}', 'utf8');
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            enterDestinationDirectory: vi.fn().mockResolvedValue(''),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        await expect(fs.readFile(path.join(cwd, 'app', 'index.ts'), 'utf8')).resolves.toBe('');
        expect(prompts.enterDestinationDirectory).toHaveBeenCalledWith(cwd);
    });

    it.each([
        [
            'plain text with invalid indentation',
            `Directory structure:
└── app/
        └── deep.ts`,
        ],
        ['malformed JSON', '{ invalid'],
    ] as const)(
        'explains %s and offers to fix it before changing the destination',
        async (_description, content) => {
            const cwd = await createTemporaryDirectory();
            const inputPath = path.join(cwd, 'input');
            const destination = path.join(cwd, 'destination');
            await fs.writeFile(inputPath, content, 'utf8');
            await fs.mkdir(destination);
            const prompts = createPrompts({
                enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            });
            await expect(
                runCli({
                    fileSystem: new NodeFileSystemAdapter(),
                    clipboard: { write: vi.fn() },
                    prompts,
                    cwd,
                }),
            ).resolves.toBe(0);
            expect(prompts.error).toHaveBeenCalledOnce();
            expect(prompts.chooseInvalidStructureAction).toHaveBeenCalledOnce();
            expect(prompts.cancel).toHaveBeenCalledWith('Operation cancelled.');
            expect(prompts.confirmStructureCreation).not.toHaveBeenCalled();
            await expect(fs.readdir(destination)).resolves.toEqual([]);
        },
    );
    it.each([
        ['JSON with a traversal name', '{"../outside":null}'],
        ['JSON with duplicate generated paths', '{"bundle":["js","js"]}'],
        ['JSON with a file/directory collision', '{"app.ts":{},"app":"ts"}'],
    ] as const)('rejects %s before changing the destination', async (_description, content) => {
        const cwd = await createTemporaryDirectory();
        const inputPath = path.join(cwd, 'input');
        const destination = path.join(cwd, 'destination');
        await fs.writeFile(inputPath, content, 'utf8');
        await fs.mkdir(destination);
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
        });
        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);
        await expect(fs.readdir(destination)).resolves.toEqual([]);
        expect(prompts.confirmStructureCreation).not.toHaveBeenCalled();
        expect(prompts.error).toHaveBeenCalledOnce();
    });
    it('rejects a nonexistent destination before preview or mutation', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = path.join(cwd, 'structure.txt');
        await fs.writeFile(inputPath, 'Directory structure:\n└── app/');
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            enterDestinationDirectory: vi.fn().mockResolvedValue('missing'),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        expect(prompts.showPreview).not.toHaveBeenCalled();
        expect(prompts.confirmStructureCreation).not.toHaveBeenCalled();
        expect(prompts.error).toHaveBeenCalledOnce();
    });

    it('rejects a symbolic-link destination before preview or mutation', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = await createProject(cwd, 'Directory structure:\n└── app/');
        const destinationPath = path.join(cwd, 'destination');
        const adapter = new NodeFileSystemAdapter();
        const originalLstat = adapter.lstat.bind(adapter);
        vi.spyOn(adapter, 'lstat').mockImplementation(async (filePath) => {
            if (filePath === adapter.toFolderPath(destinationPath)) {
                return { kind: 'symlink', symlink: 'resolved-as-symlink' };
            }
            return originalLstat(filePath);
        });
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
        });

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        expect(prompts.showPreview).not.toHaveBeenCalled();
        expect(prompts.confirmStructureCreation).not.toHaveBeenCalled();
    });

    it.each([
        { kind: 'symlink' as const, symlink: 'resolved-as-symlink' as const },
        { kind: 'unknown' as const, symlink: 'unknown' as const },
    ])('blocks unsafe existing target metadata: %o', async (metadata) => {
        const cwd = await createTemporaryDirectory();
        const inputPath = path.join(cwd, 'structure.json');
        const destination = path.join(cwd, 'destination');
        await fs.writeFile(inputPath, '{"link":null}', 'utf8');
        await fs.mkdir(destination);
        const adapter = new NodeFileSystemAdapter();
        const originalLstat = adapter.lstat.bind(adapter);
        vi.spyOn(adapter, 'lstat').mockImplementation(async (filePath) => {
            if (filePath === adapter.toFolderPath(path.join(destination, 'link'))) {
                return metadata;
            }
            return originalLstat(filePath);
        });
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
        });

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        await expect(fs.readdir(destination)).resolves.toEqual([]);
        expect(prompts.confirmStructureCreation).not.toHaveBeenCalled();
    });

    it('does not mutate when the user declines a confirmed replacement', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = await createProject(
            cwd,
            'Directory structure:\n├── keep.txt\n└── new.txt',
        );
        const destination = path.join(cwd, 'destination');
        await fs.writeFile(path.join(destination, 'keep.txt'), 'preserve this');
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            chooseFileConflictResolution: vi.fn().mockResolvedValue('replace'),
            confirmStructureCreation: vi.fn().mockResolvedValue(false),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        await expect(fs.readdir(destination)).resolves.toEqual(['keep.txt']);
        await expect(fs.readFile(path.join(destination, 'keep.txt'), 'utf8')).resolves.toBe(
            'preserve this',
        );
        expect(prompts.confirmStructureCreation).toHaveBeenCalledWith(
            expect.stringContaining('existing regular file(s) will be emptied'),
        );
        expect(prompts.cancel).toHaveBeenCalledWith(
            'Structure creation cancelled; no changes were made.',
        );
    });

    it('does not mutate when the user selects Cancel at the conflict prompt', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = await createProject(
            cwd,
            'Directory structure:\n├── keep.txt\n└── new.txt',
        );
        const destination = path.join(cwd, 'destination');
        await fs.writeFile(path.join(destination, 'keep.txt'), 'preserve this');
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            chooseFileConflictResolution: vi.fn().mockResolvedValue('cancel'),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        await expect(fs.readdir(destination)).resolves.toEqual(['keep.txt']);
        await expect(fs.readFile(path.join(destination, 'keep.txt'), 'utf8')).resolves.toBe(
            'preserve this',
        );
        expect(prompts.confirmStructureCreation).not.toHaveBeenCalled();
        expect(prompts.cancel).toHaveBeenCalledWith(
            'Structure creation cancelled; no changes were made.',
        );
    });

    it('preserves existing file contents when the user chooses Skip', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = await createProject(
            cwd,
            'Directory structure:\n├── keep.txt\n└── new.txt',
        );
        const destination = path.join(cwd, 'destination');
        await fs.writeFile(path.join(destination, 'keep.txt'), 'preserve this');
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            chooseFileConflictResolution: vi.fn().mockResolvedValue('skip'),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        await expect(fs.readFile(path.join(destination, 'keep.txt'), 'utf8')).resolves.toBe(
            'preserve this',
        );
        await expect(fs.readFile(path.join(destination, 'new.txt'), 'utf8')).resolves.toBe('');
        expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('skipped 1 file'));
    });

    it('replaces only regular files after explicit selection and confirmation', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = await createProject(cwd, 'Directory structure:\n└── replace.txt');
        const destination = path.join(cwd, 'destination');
        await fs.writeFile(path.join(destination, 'replace.txt'), 'old content');
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            chooseFileConflictResolution: vi.fn().mockResolvedValue('replace'),
            confirmStructureCreation: vi.fn().mockResolvedValue(true),
        });

        await expect(
            runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(0);

        await expect(fs.readFile(path.join(destination, 'replace.txt'), 'utf8')).resolves.toBe('');
        expect(prompts.confirmStructureCreation).toHaveBeenCalledWith(
            expect.stringContaining('1 existing regular file(s) will be emptied'),
        );
    });

    it('cancels without mutation at each creation prompt stage', async () => {
        const stages = [
            'chooseOperation',
            'chooseStructureSource',
            'enterStructurePath',
            'enterDestinationDirectory',
            'chooseFileConflictResolution',
            'confirmStructureCreation',
        ] as const;

        for (const stage of stages) {
            const cwd = await createTemporaryDirectory();
            const inputPath = await createProject(cwd, 'Directory structure:\n└── exists.txt');
            await fs.writeFile(path.join(cwd, 'destination', 'exists.txt'), 'keep');
            const prompts = createPrompts({
                enterStructurePath: vi.fn().mockResolvedValue(inputPath),
                [stage]: vi.fn().mockResolvedValue(CANCELLED),
            });

            await expect(
                runCli({
                    fileSystem: new NodeFileSystemAdapter(),
                    clipboard: { write: vi.fn() },
                    prompts,
                    cwd,
                }),
            ).resolves.toBe(0);

            await expect(
                fs.readFile(path.join(cwd, 'destination', 'exists.txt'), 'utf8'),
            ).resolves.toBe('keep');
            await expect(fs.readdir(path.join(cwd, 'destination'))).resolves.toEqual([
                'exists.txt',
            ]);
        }
    });

    it('leaves the destination exactly as it was when a real write fails halfway', async () => {
        const cwd = await createTemporaryDirectory();
        const inputPath = path.join(cwd, 'structure.json');
        await fs.writeFile(
            inputPath,
            '{"app":{},"replace":"txt","created":"txt","failed":"txt"}',
            'utf8',
        );
        const destination = path.join(cwd, 'destination');
        await fs.mkdir(destination);
        await fs.writeFile(path.join(destination, 'replace.txt'), 'old content');
        const adapter = new NodeFileSystemAdapter();
        const createFileExclusive = adapter.createFileExclusive.bind(adapter);
        const failedPath = adapter.toFolderPath(path.join(destination, 'failed.txt'));
        vi.spyOn(adapter, 'createFileExclusive').mockImplementation(async (filePath, content) => {
            if (filePath === failedPath) {
                throw new Error('disk full');
            }
            await createFileExclusive(filePath, content);
        });
        const prompts = createPrompts({
            enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            chooseFileConflictResolution: vi.fn().mockResolvedValue('replace'),
        });

        await expect(
            runCli({
                fileSystem: adapter,
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            }),
        ).resolves.toBe(1);

        // Only what was there before remains, and the replaced file has its content back.
        await expect(fs.readdir(destination)).resolves.toEqual(['replace.txt']);
        await expect(fs.readFile(path.join(destination, 'replace.txt'), 'utf8')).resolves.toBe(
            'old content',
        );
        expect(prompts.error).toHaveBeenCalledWith(
            expect.stringContaining(
                'Creation stopped at "failed.txt". Nothing was changed: everything this run created was removed, and replaced files were restored.',
            ),
        );
        expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('Cause: disk full'));
    });

    describe('where the structure comes from', () => {
        const TREE = 'Directory structure:\n└── app/\n    ├── index.ts\n    └── README';
        const BAD_TREE = 'Directory structure:\n└── app/\n            └── too-deep.ts';

        const fakeEditor = (...saves: Array<string | Error>) => {
            const edit = vi.fn(async (_initial: string) => {
                const next = saves.shift();
                if (next instanceof Error) {
                    throw next;
                }
                return next ?? '';
            });
            return { describe: () => 'Save and close.', edit } satisfies EditorAdapter;
        };

        async function run(
            options: {
                prompts?: Partial<CliPrompts>;
                editor?: EditorAdapter;
                clipboard?: Partial<{
                    read: () => Promise<string>;
                    canRead: () => boolean;
                }>;
            } = {},
        ) {
            const cwd = await createTemporaryDirectory();
            await fs.mkdir(path.join(cwd, 'destination'));
            const prompts = createPrompts(options.prompts);
            const exitCode = await runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn(), ...options.clipboard },
                editor: options.editor,
                prompts,
                cwd,
            });
            return { exitCode, prompts, destination: path.join(cwd, 'destination') };
        }

        it('creates from text pasted in the editor, and shows how to save and exit', async () => {
            const editor = fakeEditor(`# a comment\n\n${TREE}`);
            const { exitCode, prompts, destination } = await run({
                prompts: { chooseStructureSource: vi.fn().mockResolvedValue('editor') },
                editor,
            });
            expect(exitCode).toBe(0);
            await expect(fs.stat(path.join(destination, 'app', 'index.ts'))).resolves.toBeTruthy();
            const opened = editor.edit.mock.calls[0][0];
            expect(opened).toContain('# Save and close.');
            expect(opened).toContain('# Lines that start with "# " are ignored.');
            expect(prompts.chooseStructureSource).toHaveBeenCalledWith({ clipboard: false });
        });

        it('offers the clipboard only when it can be read, and creates from it', async () => {
            const read = vi.fn().mockResolvedValue(TREE);
            const { exitCode, prompts, destination } = await run({
                prompts: { chooseStructureSource: vi.fn().mockResolvedValue('clipboard') },
                clipboard: { canRead: () => true, read },
            });
            expect(exitCode).toBe(0);
            expect(prompts.chooseStructureSource).toHaveBeenCalledWith({ clipboard: true });
            await expect(fs.stat(path.join(destination, 'app', 'README'))).resolves.toBeTruthy();
        });

        it('shows the preview and asks for confirmation before creating from pasted text', async () => {
            const { prompts, destination } = await run({
                prompts: {
                    chooseStructureSource: vi.fn().mockResolvedValue('editor'),
                    confirmStructureCreation: vi.fn().mockResolvedValue(false),
                },
                editor: fakeEditor(TREE),
            });
            expect(prompts.showPreview).toHaveBeenCalledWith(
                expect.stringContaining('[create] app/'),
                expect.any(String),
            );
            expect(prompts.cancel).toHaveBeenCalledWith(
                'Structure creation cancelled; no changes were made.',
            );
            expect(await fs.readdir(destination)).toEqual([]);
        });

        it('lets the user fix an invalid structure in the editor, and tells them what was wrong', async () => {
            const editor = fakeEditor(BAD_TREE, TREE);
            const { exitCode, prompts, destination } = await run({
                prompts: {
                    chooseStructureSource: vi.fn().mockResolvedValue('editor'),
                    chooseInvalidStructureAction: vi.fn().mockResolvedValue('edit'),
                },
                editor,
            });
            expect(exitCode).toBe(0);
            expect(prompts.error).toHaveBeenCalledWith(
                expect.stringContaining('- line 3: └── too-deep.ts'),
            );
            const reopened = editor.edit.mock.calls[1][0];
            expect(reopened).toContain('#   line 3: └── too-deep.ts');
            expect(reopened).toContain(BAD_TREE);
            await expect(fs.stat(path.join(destination, 'app', 'index.ts'))).resolves.toBeTruthy();
        });

        it('lets the user fix an invalid clipboard structure too', async () => {
            const editor = fakeEditor(TREE);
            const { exitCode, destination } = await run({
                prompts: {
                    chooseStructureSource: vi.fn().mockResolvedValue('clipboard'),
                    chooseInvalidStructureAction: vi.fn().mockResolvedValue('edit'),
                },
                editor,
                clipboard: { canRead: () => true, read: async () => BAD_TREE },
            });
            expect(exitCode).toBe(0);
            expect(editor.edit.mock.calls[0][0]).toContain(BAD_TREE);
            await expect(fs.stat(path.join(destination, 'app', 'index.ts'))).resolves.toBeTruthy();
        });

        it('creates nothing when an invalid structure is cancelled', async () => {
            const { exitCode, prompts, destination } = await run({
                prompts: { chooseStructureSource: vi.fn().mockResolvedValue('editor') },
                editor: fakeEditor(BAD_TREE),
            });
            expect(exitCode).toBe(0);
            expect(prompts.cancel).toHaveBeenCalledWith('Operation cancelled.');
            expect(await fs.readdir(destination)).toEqual([]);
        });

        it('returns to the menu when there is nothing to use', async () => {
            const chooseStructureSource = vi
                .fn()
                .mockResolvedValueOnce('editor') // saved only comments
                .mockResolvedValueOnce('editor') // no editor installed
                .mockResolvedValueOnce('clipboard') // clipboard has no text
                .mockResolvedValueOnce('clipboard') // clipboard cannot be read
                .mockResolvedValueOnce('editor'); // finally a real structure
            const read = vi
                .fn()
                .mockResolvedValueOnce('  \n')
                .mockRejectedValueOnce(new Error('No clipboard tool found.'));
            const { exitCode, prompts, destination } = await run({
                prompts: { chooseStructureSource },
                editor: fakeEditor(
                    '# only a comment',
                    new EditorUnavailableError('No text editor found.'),
                    TREE,
                ),
                clipboard: { canRead: () => true, read },
            });
            expect(exitCode).toBe(0);
            expect(prompts.warn).toHaveBeenCalledWith(
                expect.stringContaining('Nothing was entered.'),
            );
            expect(prompts.warn).toHaveBeenCalledWith('The clipboard has no text.');
            expect(prompts.error).toHaveBeenCalledWith('No text editor found.');
            expect(prompts.error).toHaveBeenCalledWith('No clipboard tool found.');
            expect(chooseStructureSource).toHaveBeenCalledTimes(5);
            await expect(fs.stat(path.join(destination, 'app', 'index.ts'))).resolves.toBeTruthy();
        });

        it('passes an editor that crashes on as an error', async () => {
            const { exitCode, prompts } = await run({
                prompts: { chooseStructureSource: vi.fn().mockResolvedValue('editor') },
                editor: fakeEditor(new Error('The editor exited with code 1.')),
            });
            expect(exitCode).toBe(1);
            expect(prompts.error).toHaveBeenCalledWith('The editor exited with code 1.');
        });

        it('still reads a structure file, without asking for its format', async () => {
            const cwd = await createTemporaryDirectory();
            const inputPath = await createProject(cwd, '└── lib/\n    └── a.ts');
            const prompts = createPrompts({
                enterStructurePath: vi.fn().mockResolvedValue(inputPath),
            });
            const exitCode = await runCli({
                fileSystem: new NodeFileSystemAdapter(),
                clipboard: { write: vi.fn() },
                prompts,
                cwd,
            });
            expect(exitCode).toBe(0);
            await expect(
                fs.stat(path.join(cwd, 'destination', 'lib', 'a.ts')),
            ).resolves.toBeTruthy();
        });
    });
});
