import { beforeEach, describe, expect, it } from 'vitest';
import {
    FolderFileSystemError,
    type DirectoryEntry,
    type EntryMetadata,
    type FolderPath,
    type FolderStructureFileSystem,
    traverseFolderStructure,
} from '../src/index.js';

const rootPath = '/workspace/project' as FolderPath;
const directory: EntryMetadata = { kind: 'directory', symlink: 'not-a-symlink' };
const file: EntryMetadata = { kind: 'file', symlink: 'not-a-symlink' };
const symlink: EntryMetadata = { kind: 'symlink', symlink: 'resolved-as-symlink' };
const unknown: EntryMetadata = { kind: 'unknown', symlink: 'unknown' };

function entry(name: string, metadata: EntryMetadata): DirectoryEntry {
    return { name, metadata };
}

class MemoryFileSystem implements FolderStructureFileSystem {
    directories = new Map<string, DirectoryEntry[]>();
    files = new Map<string, string>();
    errors = new Map<string, FolderFileSystemError>();

    async readDirectory(path: FolderPath): Promise<DirectoryEntry[]> {
        this.throwIfError(path);
        const entries = this.directories.get(path);
        if (!entries) {
            throw new FolderFileSystemError('NOT_DIRECTORY', `Not a directory: ${path}`);
        }
        return entries;
    }

    async readText(path: FolderPath): Promise<string> {
        this.throwIfError(path);
        const content = this.files.get(path);
        if (content === undefined) {
            throw new FolderFileSystemError('NOT_FOUND', `Not found: ${path}`);
        }
        return content;
    }

    async lstat(path: FolderPath): Promise<EntryMetadata> {
        this.throwIfError(path);
        if (this.directories.has(path)) {
            return directory;
        }
        if (this.files.has(path)) {
            return file;
        }
        throw new FolderFileSystemError('NOT_FOUND', `Not found: ${path}`);
    }

    async exists(path: FolderPath): Promise<boolean> {
        try {
            await this.lstat(path);
            return true;
        } catch (error) {
            if (error instanceof FolderFileSystemError && error.code === 'NOT_FOUND') {
                return false;
            }
            throw error;
        }
    }

    async createDirectory(): Promise<void> {}

    async writeText(): Promise<void> {}

    joinChild(parent: FolderPath, name: string): FolderPath {
        return `${parent.replace(/\/+$/, '')}/${name}` as FolderPath;
    }

    relative(base: FolderPath, path: FolderPath): string {
        const prefix = `${base.replace(/\/+$/, '')}/`;
        if (!path.startsWith(prefix)) {
            throw new FolderFileSystemError('INVALID_PATH', 'Path is outside the root.');
        }
        return path.slice(prefix.length);
    }

    basename(path: FolderPath): string {
        return path.split('/').filter(Boolean).pop() ?? path;
    }

    private throwIfError(path: FolderPath): void {
        const error = this.errors.get(path);
        if (error) {
            throw error;
        }
    }
}

class RootMetadataFileSystem extends MemoryFileSystem {
    constructor(private readonly rootMetadata: EntryMetadata) {
        super();
    }

    override async lstat(path: FolderPath): Promise<EntryMetadata> {
        if (path === rootPath) {
            return this.rootMetadata;
        }
        return super.lstat(path);
    }
}

function createFileSystem(): MemoryFileSystem {
    const fileSystem = new MemoryFileSystem();
    fileSystem.directories.set(rootPath, []);
    return fileSystem;
}

const defaultOptions = {
    ignorePatterns: [] as string[],
    respectGitignore: true,
};

describe('traverseFolderStructure', () => {
    let fileSystem: MemoryFileSystem;

    beforeEach(() => {
        fileSystem = createFileSystem();
    });

    it('recursively converts files and directories while preserving provider order', async () => {
        fileSystem.directories.set(rootPath, [
            entry('src', directory),
            entry('README', file),
            entry('package.json', file),
            entry('package.lock', file),
            entry('empty', directory),
        ]);
        fileSystem.directories.set('/workspace/project/src' as FolderPath, [
            entry('index.ts', file),
        ]);
        fileSystem.directories.set('/workspace/project/empty' as FolderPath, []);

        const structure = await traverseFolderStructure(fileSystem, rootPath, defaultOptions);
        const project = structure.project;
        if (project === null || typeof project !== 'object' || Array.isArray(project)) {
            throw new Error('Expected the project root to be a directory.');
        }
        expect(Object.keys(project)).toEqual(['src', 'README', 'package', 'empty']);
        expect(structure).toEqual({
            project: {
                src: { index: 'ts' },
                README: 'file',
                package: ['json', 'lock'],
                empty: {},
            },
        });
    });

    it('handles multiple root entries and empty root directories', async () => {
        fileSystem.directories.set(rootPath, [
            entry('first', directory),
            entry('second.txt', file),
        ]);
        fileSystem.directories.set('/workspace/project/first' as FolderPath, []);

        await expect(
            traverseFolderStructure(fileSystem, rootPath, defaultOptions),
        ).resolves.toEqual({ project: { first: {}, second: 'txt' } });

        fileSystem.directories.set(rootPath, []);
        await expect(
            traverseFolderStructure(fileSystem, rootPath, defaultOptions),
        ).resolves.toEqual({ project: {} });
    });

    it('excludes hidden entries by default and lets explicit patterns remain active', async () => {
        fileSystem.directories.set(rootPath, [
            entry('.private', directory),
            entry('.env', file),
            entry('visible.txt', file),
        ]);

        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                includeHidden: true,
                ignorePatterns: ['.*'],
            }),
        ).resolves.toEqual({ project: { visible: 'txt' } });
    });

    it('applies configured ignore patterns to files and directories', async () => {
        fileSystem.directories.set(rootPath, [
            entry('node_modules', directory),
            entry('keep', directory),
            entry('secret.txt', file),
        ]);
        fileSystem.directories.set('/workspace/project/node_modules' as FolderPath, [
            entry('dep.js', file),
        ]);
        fileSystem.directories.set('/workspace/project/keep' as FolderPath, []);

        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                ignorePatterns: ['node_modules', 'secret.txt'],
            }),
        ).resolves.toEqual({ project: { keep: {} } });
    });

    it('loads only root .gitignore rules and matches directory-specific patterns', async () => {
        fileSystem.directories.set(rootPath, [
            entry('build', directory),
            entry('src', directory),
            entry('keep.log', file),
        ]);
        fileSystem.directories.set('/workspace/project/build' as FolderPath, [
            entry('bundle.js', file),
        ]);
        fileSystem.directories.set('/workspace/project/src' as FolderPath, [
            entry('build', directory),
            entry('main.ts', file),
        ]);
        fileSystem.directories.set('/workspace/project/src/build' as FolderPath, []);
        fileSystem.files.set('/workspace/project/.gitignore' as FolderPath, 'build/\n*.log\n');

        await expect(
            traverseFolderStructure(fileSystem, rootPath, defaultOptions),
        ).resolves.toEqual({ project: { src: { main: 'ts' } } });
    });

    it('propagates errors while checking or reading the root .gitignore', async () => {
        const failure = new FolderFileSystemError(
            'PERMISSION_DENIED',
            'Unable to inspect .gitignore.',
        );
        fileSystem.errors.set('/workspace/project/.gitignore' as FolderPath, failure);

        await expect(traverseFolderStructure(fileSystem, rootPath, defaultOptions)).rejects.toBe(
            failure,
        );
    });

    it('preserves configured patterns before root .gitignore patterns', async () => {
        fileSystem.directories.set(rootPath, [
            entry('configured.txt', file),
            entry('gitignored.txt', file),
            entry('kept.txt', file),
        ]);
        fileSystem.files.set('/workspace/project/.gitignore' as FolderPath, 'gitignored.txt\n');

        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                ignorePatterns: ['configured.txt'],
            }),
        ).resolves.toEqual({ project: { kept: 'txt' } });
    });

    it('applies depth limits at the root and child boundary', async () => {
        fileSystem.directories.set(rootPath, [entry('src', directory), entry('root.txt', file)]);
        fileSystem.directories.set('/workspace/project/src' as FolderPath, [
            entry('deep', directory),
            entry('index.ts', file),
        ]);
        fileSystem.directories.set('/workspace/project/src/deep' as FolderPath, [
            entry('leaf.txt', file),
        ]);

        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                maxDepth: 0,
            }),
        ).resolves.toEqual({ project: {} });
        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                maxDepth: 1,
            }),
        ).resolves.toEqual({ project: { src: {}, root: 'txt' } });
        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                maxDepth: 2,
            }),
        ).resolves.toEqual({ project: { src: { deep: {}, index: 'ts' }, root: 'txt' } });
    });

    it('does not traverse known symlinks and skips unknown metadata', async () => {
        fileSystem.directories.set(rootPath, [
            entry('linked-dir', symlink),
            entry('ambiguous', unknown),
            entry('ordinary.txt', file),
        ]);

        await expect(
            traverseFolderStructure(fileSystem, rootPath, defaultOptions),
        ).resolves.toEqual({ project: { 'linked-dir': 'file', ordinary: 'txt' } });
    });

    it('propagates filesystem failures during traversal', async () => {
        const failure = new FolderFileSystemError(
            'PERMISSION_DENIED',
            'Unable to read a child directory.',
        );
        fileSystem.directories.set(rootPath, [entry('restricted', directory)]);
        fileSystem.errors.set('/workspace/project/restricted' as FolderPath, failure);

        await expect(traverseFolderStructure(fileSystem, rootPath, defaultOptions)).rejects.toBe(
            failure,
        );
    });

    it('rejects unknown or symlink traversal roots', async () => {
        const unknownRoot = new RootMetadataFileSystem(unknown);
        await expect(
            traverseFolderStructure(unknownRoot, rootPath, defaultOptions),
        ).rejects.toMatchObject({ code: 'NOT_DIRECTORY' });

        const symlinkRoot = new RootMetadataFileSystem(symlink);
        await expect(
            traverseFolderStructure(symlinkRoot, rootPath, defaultOptions),
        ).rejects.toMatchObject({ code: 'NOT_DIRECTORY' });
    });

    it('rejects invalid depth values', async () => {
        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                maxDepth: -1,
            }),
        ).rejects.toThrow(RangeError);
        await expect(
            traverseFolderStructure(fileSystem, rootPath, {
                ...defaultOptions,
                maxDepth: 1.5,
            }),
        ).rejects.toThrow(RangeError);
    });
});
