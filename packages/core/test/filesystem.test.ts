import { describe, expect, it } from 'vitest';
import { FolderFileSystemError } from '../src/filesystem.js';
import type {
    DirectoryEntry,
    EntryMetadata,
    ExclusiveFileCreation,
    FolderPath,
    FolderStructureFileSystem,
} from '../src/filesystem.js';

const root = '/project' as FolderPath;
const file = '/project/index.ts' as FolderPath;

class MockFileSystem implements FolderStructureFileSystem {
    async readDirectory(): Promise<DirectoryEntry[]> {
        return [];
    }

    async readText(): Promise<string> {
        return '';
    }

    async lstat(): Promise<EntryMetadata> {
        return { kind: 'unknown', symlink: 'unknown' };
    }

    async exists(): Promise<boolean> {
        return false;
    }

    async createDirectory(): Promise<void> {}

    async writeText(): Promise<void> {}

    joinChild(parent: FolderPath, name: string): FolderPath {
        return `${parent}/${name}` as FolderPath;
    }

    relative(): string {
        return 'index.ts';
    }

    basename(): string {
        return 'index.ts';
    }
}

class MockExclusiveFileSystem extends MockFileSystem implements ExclusiveFileCreation {
    async createFileExclusive(): Promise<void> {}
}

describe('filesystem contracts', () => {
    it('allows adapters without the optional exclusive-create capability', async () => {
        const fileSystem: FolderStructureFileSystem = new MockFileSystem();

        expect(fileSystem.joinChild(root, 'index.ts')).toBe(file);
    });

    it('allows adapters to implement exclusive creation as an optional capability', async () => {
        const fileSystem: FolderStructureFileSystem & ExclusiveFileCreation =
            new MockExclusiveFileSystem();

        await expect(fileSystem.createFileExclusive(file, '')).resolves.toBeUndefined();
    });

    it('preserves normalized error codes and causes', () => {
        const cause = new Error('Permission denied');
        const error = new FolderFileSystemError('PERMISSION_DENIED', 'Unable to inspect path', {
            cause,
        });

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('FolderFileSystemError');
        expect(error.code).toBe('PERMISSION_DENIED');
        expect(error.cause).toBe(cause);
    });
});
