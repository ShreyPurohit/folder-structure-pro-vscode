import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
        chooseStructureFormat: vi.fn().mockResolvedValue('text'),
        enterStructurePath: vi.fn().mockResolvedValue('structure.txt'),
        enterDestinationDirectory: vi.fn().mockResolvedValue('destination'),
        chooseFileConflictResolution: vi.fn().mockResolvedValue('skip'),
        confirmStructureCreation: vi.fn().mockResolvedValue(true),
        showPreview: vi.fn(),
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
            chooseStructureFormat: vi.fn().mockResolvedValue('json'),
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
            'text',
            `Directory structure:
└── app/
        └── deep.ts`,
        ],
        ['malformed JSON', 'json', '{ invalid'],
        ['JSON with a traversal name', 'json', '{"../outside":null}'],
        ['JSON with duplicate generated paths', 'json', '{"bundle":["js","js"]}'],
        ['JSON with a file/directory collision', 'json', '{"app.ts":{},"app":"ts"}'],
    ] as const)(
        'rejects %s before changing the destination',
        async (_description, format, content) => {
            const cwd = await createTemporaryDirectory();
            const inputPath = path.join(cwd, 'input');
            const destination = path.join(cwd, 'destination');
            await fs.writeFile(inputPath, content, 'utf8');
            await fs.mkdir(destination);
            const prompts = createPrompts({
                chooseStructureFormat: vi.fn().mockResolvedValue(format),
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
        },
    );

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
            chooseStructureFormat: vi.fn().mockResolvedValue('json'),
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
            'chooseStructureFormat',
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

    it('reports replacements, creations, and the failed path when execution partially fails', async () => {
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
            chooseStructureFormat: vi.fn().mockResolvedValue('json'),
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

        const appStats = await fs.stat(path.join(destination, 'app'));
        expect(appStats.isDirectory()).toBe(true);
        await expect(fs.readFile(path.join(destination, 'replace.txt'), 'utf8')).resolves.toBe('');
        await expect(fs.readFile(path.join(destination, 'created.txt'), 'utf8')).resolves.toBe('');
        await expect(fs.stat(path.join(destination, 'failed.txt'))).rejects.toMatchObject({
            code: 'ENOENT',
        });
        expect(prompts.error).toHaveBeenCalledWith(
            expect.stringContaining(
                'Completed before failure: 1 directory created, 0 directories reused, 1 file created, 1 file replaced, and 0 files skipped.',
            ),
        );
        expect(prompts.error).toHaveBeenCalledWith(
            expect.stringContaining('Creation stopped at "failed.txt"'),
        );
        expect(prompts.error).toHaveBeenCalledWith(
            expect.stringContaining(
                'The failed operation may have partially affected "failed.txt"; no rollback was attempted.',
            ),
        );
        expect(prompts.error).toHaveBeenCalledWith(expect.stringContaining('Cause: disk full'));
    });
});
