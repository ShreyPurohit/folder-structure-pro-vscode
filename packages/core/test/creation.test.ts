import { describe, expect, it } from 'vitest';
import {
    executeStructureCreation,
    FolderFileSystemError,
    planStructureCreation,
    StructureCreationExecutionError,
    StructureCreationValidationError,
    type CreationRollback,
    type DirectoryEntry,
    type EntryMetadata,
    type ExclusiveFileCreation,
    type FolderPath,
    type FolderStructureFileSystem,
} from '../src/index.js';

const ROOT = '/destination' as FolderPath;

interface MemoryEntry {
    metadata: EntryMetadata;
    content?: string;
}

class MemoryFileSystem
    implements FolderStructureFileSystem, ExclusiveFileCreation, CreationRollback
{
    readonly entries = new Map<string, MemoryEntry>([
        [ROOT, { metadata: { kind: 'directory', symlink: 'not-a-symlink' } }],
    ]);
    readonly mutations: string[] = [];
    readonly createFailure = new Error('Synthetic write failure.');
    failCreatePath?: string;

    async readDirectory(_path: FolderPath): Promise<DirectoryEntry[]> {
        return [];
    }

    async readText(path: FolderPath): Promise<string> {
        const entry = this.entries.get(path);
        if (!entry || entry.metadata.kind !== 'file') {
            throw new FolderFileSystemError('NOT_FOUND', 'Missing file.');
        }
        return entry.content ?? '';
    }

    async lstat(path: FolderPath): Promise<EntryMetadata> {
        const entry = this.entries.get(path);
        if (!entry) {
            throw new FolderFileSystemError('NOT_FOUND', 'Missing path.');
        }
        return entry.metadata;
    }

    async exists(path: FolderPath): Promise<boolean> {
        return this.entries.has(path);
    }

    async createDirectory(path: FolderPath): Promise<void> {
        if (this.entries.has(path)) {
            return;
        }
        this.mutations.push(`mkdir:${path}`);
        this.entries.set(path, { metadata: { kind: 'directory', symlink: 'not-a-symlink' } });
    }

    async writeText(path: FolderPath, content: string): Promise<void> {
        this.mutations.push(`write:${path}`);
        this.entries.set(path, {
            metadata: { kind: 'file', symlink: 'not-a-symlink' },
            content,
        });
    }

    joinChild(parent: FolderPath, name: string): FolderPath {
        if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
            throw new FolderFileSystemError('INVALID_PATH', 'Invalid child.');
        }
        return `${parent}/${name}` as FolderPath;
    }

    relative(base: FolderPath, path: FolderPath): string {
        return path.slice(base.length + 1);
    }

    basename(path: FolderPath): string {
        return path.slice(path.lastIndexOf('/') + 1);
    }

    async createFileExclusive(path: FolderPath, content: string): Promise<void> {
        this.mutations.push(`create:${path}`);
        if (path === this.failCreatePath) {
            throw this.createFailure;
        }
        if (this.entries.has(path)) {
            throw new FolderFileSystemError('ALREADY_EXISTS', 'Path already exists.');
        }
        this.entries.set(path, {
            metadata: { kind: 'file', symlink: 'not-a-symlink' },
            content,
        });
    }

    failUndoPath?: string;
    private backups = 0;
    private refuseUndo(path: FolderPath): void {
        if (path === this.failUndoPath) {
            throw new Error('Synthetic undo failure.');
        }
    }
    async replaceWithEmptyFile(path: FolderPath): Promise<FolderPath> {
        this.mutations.push(`replace:${path}`);
        const original = this.entries.get(path);
        if (!original || original.metadata.kind !== 'file') {
            throw new FolderFileSystemError('INVALID_PATH', 'Not a file.');
        }
        const backup = `${path}.backup${++this.backups}` as FolderPath;
        this.entries.set(backup, original);
        this.entries.set(path, { metadata: original.metadata, content: '' });
        return backup;
    }
    async restoreFile(backup: FolderPath, path: FolderPath): Promise<void> {
        this.refuseUndo(path);
        const original = this.entries.get(backup);
        if (!original) {
            throw new FolderFileSystemError('NOT_FOUND', 'Missing backup.');
        }
        this.entries.delete(backup);
        this.entries.set(path, original);
    }
    async removeFile(path: FolderPath): Promise<void> {
        this.refuseUndo(path);
        if (this.entries.get(path)?.metadata.kind !== 'file') {
            throw new FolderFileSystemError('INVALID_PATH', 'Not a file.');
        }
        this.entries.delete(path);
    }
    readonly discarded: string[] = [];
    async discardBackup(backup: FolderPath): Promise<void> {
        this.discarded.push(backup);
        await this.removeFile(backup);
    }
    async removeEmptyDirectory(path: FolderPath): Promise<void> {
        this.refuseUndo(path);
        const hasChildren = [...this.entries.keys()].some((key) => key.startsWith(`${path}/`));
        if (hasChildren) {
            throw new FolderFileSystemError('IO_ERROR', 'Directory not empty.');
        }
        this.entries.delete(path);
    }
    /** Every path and content, so a test can compare the whole destination with a snapshot. */
    snapshot(): Array<[string, string | undefined]> {
        return [...this.entries].map(([key, entry]) => [key, entry.content]).sort() as Array<
            [string, string | undefined]
        >;
    }
    seed(path: string, metadata: EntryMetadata, content = ''): void {
        this.entries.set(path, { metadata, content });
    }
}

describe('structure creation planning', () => {
    it('plans directories and files without mutating the filesystem', async () => {
        const fileSystem = new MemoryFileSystem();
        const plan = await planStructureCreation(fileSystem, ROOT, {
            app: {
                index: 'ts',
                package: ['json', 'lock'],
                README: null,
            },
        });

        expect(
            plan.entries.map(({ relativePath, kind, status }) => [relativePath, kind, status]),
        ).toEqual([
            ['app', 'directory', 'missing'],
            ['app/index.ts', 'file', 'missing'],
            ['app/package.json', 'file', 'missing'],
            ['app/package.lock', 'file', 'missing'],
            ['app/README', 'file', 'missing'],
        ]);
        expect(plan.conflicts).toEqual([]);
        expect(fileSystem.mutations).toEqual([]);
    });

    it.each([
        '../outside',
        'nested/name',
        'nested\\name',
        'C:\\outside',
        'CON',
        'trailing.',
        'trailing ',
        'bad:name',
    ])('rejects unsafe or nonportable path component %s', async (name) => {
        const fileSystem = new MemoryFileSystem();
        await expect(
            planStructureCreation(fileSystem, ROOT, { [name]: null }),
        ).rejects.toBeInstanceOf(StructureCreationValidationError);
        expect(fileSystem.mutations).toEqual([]);
    });

    it('rejects duplicate output paths and file/directory collisions', async () => {
        const fileSystem = new MemoryFileSystem();
        await expect(
            planStructureCreation(fileSystem, ROOT, { bundle: ['js', 'js'] }),
        ).rejects.toThrow('Duplicate path "bundle.js".');

        await expect(
            planStructureCreation(fileSystem, ROOT, {
                'app.ts': {},
                app: 'ts',
            }),
        ).rejects.toThrow('both a file and a directory');

        await expect(
            planStructureCreation(fileSystem, ROOT, {
                Readme: null,
                README: null,
            }),
        ).rejects.toThrow('Duplicate path "README".');
        expect(fileSystem.mutations).toEqual([]);
    });

    it.each([
        { kind: 'symlink', symlink: 'resolved-as-symlink' },
        { kind: 'unknown', symlink: 'unknown' },
    ] as const)('rejects existing paths with unsafe metadata: %o', async (metadata) => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/link`, metadata);

        await expect(planStructureCreation(fileSystem, ROOT, { link: null })).rejects.toThrow(
            'symbolic link or has unknown filesystem metadata',
        );
        expect(fileSystem.mutations).toEqual([]);
    });

    it('rejects existing paths with a file/directory type mismatch', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/app`, { kind: 'file', symlink: 'not-a-symlink' });

        await expect(planStructureCreation(fileSystem, ROOT, { app: {} })).rejects.toThrow(
            'requires a directory',
        );
        expect(fileSystem.mutations).toEqual([]);
    });

    it('rejects empty and invalid structure shapes', async () => {
        const fileSystem = new MemoryFileSystem();
        await expect(planStructureCreation(fileSystem, ROOT, {})).rejects.toThrow('empty');
        await expect(planStructureCreation(fileSystem, ROOT, { app: [] })).rejects.toThrow(
            'nested directories',
        );
        expect(fileSystem.mutations).toEqual([]);
    });

    it('rejects a symbolic-link or unknown destination root', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(ROOT, { kind: 'symlink', symlink: 'resolved-as-symlink' });

        await expect(planStructureCreation(fileSystem, ROOT, { app: {} })).rejects.toThrow(
            'destination must be a known directory',
        );
        expect(fileSystem.mutations).toEqual([]);
    });
});

describe('structure creation execution', () => {
    it('creates new files exclusively and reuses matching directories', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/app`, { kind: 'directory', symlink: 'not-a-symlink' });
        const plan = await planStructureCreation(fileSystem, ROOT, {
            app: { index: 'ts' },
        });

        const result = await executeStructureCreation(fileSystem, plan, 'skip');

        expect(result).toMatchObject({
            directoriesCreated: 0,
            directoriesReused: 1,
            filesCreated: 1,
        });
        expect(fileSystem.mutations).toEqual([`create:${ROOT}/app/index.ts`]);
        await expect(fileSystem.readText(`${ROOT}/app/index.ts` as FolderPath)).resolves.toBe('');
    });

    it('preserves existing file contents when conflicts are skipped', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/keep.txt`, { kind: 'file', symlink: 'not-a-symlink' }, 'keep me');
        const plan = await planStructureCreation(fileSystem, ROOT, { keep: 'txt' });

        const result = await executeStructureCreation(fileSystem, plan, 'skip');

        expect(result.filesSkipped).toBe(1);
        await expect(fileSystem.readText(`${ROOT}/keep.txt` as FolderPath)).resolves.toBe(
            'keep me',
        );
        expect(fileSystem.mutations).toEqual([]);
    });

    it('replaces only an explicitly selected regular-file conflict', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/replace.txt`, { kind: 'file', symlink: 'not-a-symlink' }, 'old');
        const plan = await planStructureCreation(fileSystem, ROOT, { replace: 'txt' });

        const result = await executeStructureCreation(fileSystem, plan, 'replace');

        expect(result.filesReplaced).toBe(1);
        await expect(fileSystem.readText(`${ROOT}/replace.txt` as FolderPath)).resolves.toBe('');
        expect(fileSystem.mutations).toEqual([`replace:${ROOT}/replace.txt`]);
    });

    it('cancels without performing any mutations', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/existing.txt`, { kind: 'file', symlink: 'not-a-symlink' }, 'keep');
        const plan = await planStructureCreation(fileSystem, ROOT, {
            existing: 'txt',
            new: 'txt',
        });

        const result = await executeStructureCreation(fileSystem, plan, 'cancel');

        expect(result.cancelled).toBe(true);
        expect(fileSystem.mutations).toEqual([]);
        await expect(fileSystem.readText(`${ROOT}/existing.txt` as FolderPath)).resolves.toBe(
            'keep',
        );
        expect(fileSystem.entries.has(`${ROOT}/new.txt`)).toBe(false);
    });

    it('is all or nothing: a failure undoes every creation and restores replaced files', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(
            `${ROOT}/replace.txt`,
            { kind: 'file', symlink: 'not-a-symlink' },
            'old content',
        );
        fileSystem.seed(`${ROOT}/keep`, { kind: 'directory', symlink: 'not-a-symlink' });
        const before = fileSystem.snapshot();
        fileSystem.failCreatePath = `${ROOT}/keep/inner/failed.txt`;
        const plan = await planStructureCreation(fileSystem, ROOT, {
            app: { nested: {} },
            keep: { inner: { created: 'txt', failed: 'txt' } },
            replace: 'txt',
        });

        const error = await executeStructureCreation(fileSystem, plan, 'replace').catch(
            (caught: unknown) => caught,
        );

        expect(error).toBeInstanceOf(StructureCreationExecutionError);
        if (!(error instanceof StructureCreationExecutionError)) {
            throw new Error('Expected an execution error.');
        }
        expect(error.relativePath).toBe('keep/inner/failed.txt');
        expect(error.cause).toBe(fileSystem.createFailure);
        expect(error.notUndone).toEqual([]);
        expect(error.message).toBe(
            'Creation stopped at "keep/inner/failed.txt". Nothing was changed: everything this run created was removed, and replaced files were restored.',
        );
        // The destination is exactly as before, including the replaced file's content and
        // the directory that existed already.
        expect(fileSystem.snapshot()).toEqual(before);
    });

    it('undoes everything when the run is aborted between steps', async () => {
        const fileSystem = new MemoryFileSystem();
        const before = fileSystem.snapshot();
        const plan = await planStructureCreation(fileSystem, ROOT, {
            a: 'txt',
            b: 'txt',
            c: 'txt',
        });
        const controller = new AbortController();
        const originalCreate = fileSystem.createFileExclusive.bind(fileSystem);
        fileSystem.createFileExclusive = async (path, content) => {
            await originalCreate(path, content);
            controller.abort(); // Ctrl+C arrives after the first file
        };

        const error = await executeStructureCreation(fileSystem, plan, 'skip', {
            signal: controller.signal,
        }).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(StructureCreationExecutionError);
        expect(fileSystem.snapshot()).toEqual(before);
    });

    it('says exactly what could not be undone, and still undoes the rest', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.failCreatePath = `${ROOT}/failed.txt`;
        fileSystem.failUndoPath = `${ROOT}/stuck.txt`;
        const plan = await planStructureCreation(fileSystem, ROOT, {
            app: {},
            stuck: 'txt',
            removed: 'txt',
            failed: 'txt',
        });

        const error = (await executeStructureCreation(fileSystem, plan, 'skip').catch(
            (caught: unknown) => caught,
        )) as StructureCreationExecutionError;

        expect(error.notUndone).toEqual(['stuck.txt']);
        expect(error.message).toContain(
            'Some changes could not be undone. Check these paths: stuck.txt.',
        );
        expect(fileSystem.entries.has(`${ROOT}/removed.txt`)).toBe(false);
        expect(fileSystem.entries.has(`${ROOT}/app`)).toBe(false);
        expect(fileSystem.entries.has(`${ROOT}/stuck.txt`)).toBe(true);
    });

    it('never removes a directory that someone filled during the run', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.failCreatePath = `${ROOT}/app/failed.txt`;
        const plan = await planStructureCreation(fileSystem, ROOT, { app: { failed: 'txt' } });
        const originalMkdir = fileSystem.createDirectory.bind(fileSystem);
        fileSystem.createDirectory = async (path) => {
            await originalMkdir(path);
            fileSystem.seed(
                `${path}/someone-elses.txt`,
                { kind: 'file', symlink: 'not-a-symlink' },
                'keep',
            );
        };

        const error = (await executeStructureCreation(fileSystem, plan, 'skip').catch(
            (caught: unknown) => caught,
        )) as StructureCreationExecutionError;

        expect(error.notUndone).toEqual(['app']);
        await expect(
            fileSystem.readText(`${ROOT}/app/someone-elses.txt` as FolderPath),
        ).resolves.toBe('keep');
    });

    it('keeps skipped files untouched when a later step fails', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/skip.txt`, { kind: 'file', symlink: 'not-a-symlink' }, 'preserve');
        fileSystem.failCreatePath = `${ROOT}/failed.txt`;
        const plan = await planStructureCreation(fileSystem, ROOT, { skip: 'txt', failed: 'txt' });
        await expect(executeStructureCreation(fileSystem, plan, 'skip')).rejects.toBeInstanceOf(
            StructureCreationExecutionError,
        );
        await expect(fileSystem.readText(`${ROOT}/skip.txt` as FolderPath)).resolves.toBe(
            'preserve',
        );
    });

    it('removes the copies of replaced files after a successful run', async () => {
        const fileSystem = new MemoryFileSystem();
        fileSystem.seed(`${ROOT}/replace.txt`, { kind: 'file', symlink: 'not-a-symlink' }, 'old');
        const plan = await planStructureCreation(fileSystem, ROOT, { replace: 'txt' });
        const result = await executeStructureCreation(fileSystem, plan, 'replace');
        expect(result).toMatchObject({ filesReplaced: 1, leftoverBackups: [] });
        expect(fileSystem.discarded).toEqual([`${ROOT}/replace.txt.backup1`]);
        await expect(fileSystem.readText(`${ROOT}/replace.txt` as FolderPath)).resolves.toBe('');
        expect([...fileSystem.entries.keys()].some((key) => key.includes('backup'))).toBe(false);
    });

    it('revalidates the plan before any mutations', async () => {
        const fileSystem = new MemoryFileSystem();
        const plan = await planStructureCreation(fileSystem, ROOT, { item: null });
        fileSystem.seed(`${ROOT}/item`, { kind: 'file', symlink: 'not-a-symlink' });

        await expect(executeStructureCreation(fileSystem, plan, 'skip')).rejects.toThrow(
            'changed after planning',
        );
        expect(fileSystem.mutations).toEqual([]);
    });
});
