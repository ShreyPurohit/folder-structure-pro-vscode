import { beforeEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import {
    executeStructureCreation,
    planStructureCreation,
    StructureCreationExecutionError,
} from '@folder-structure-pro/core';
import { VSCodeFileSystemAdapter } from '../../src/adapters/vscodeFileSystem';
import { mockFsDelete, mockFsRename, mockFsWriteFile, resetVscodeMocks } from '../__mocks__/vscode';
import { installMemoryWorkspaceFs } from '../helpers/memoryWorkspaceFs';

const adapter = new VSCodeFileSystemAdapter();
const at = (path: string) => adapter.toFolderPath(vscode.Uri.file(path));

describe('VSCodeFileSystemAdapter creation and undo', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('creates a file only when the path is free, leaving no temporary file', async () => {
        const fs = installMemoryWorkspaceFs({ '/w': null, '/w/taken.txt': 'keep' });

        await adapter.createFileExclusive(at('/w/new.txt'), '');
        await expect(adapter.createFileExclusive(at('/w/taken.txt'), '')).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
        });

        expect(fs.read('/w/new.txt')).toBe('');
        expect(fs.read('/w/taken.txt')).toBe('keep');
        expect([...fs.nodes.keys()].sort()).toEqual(['/', '/w', '/w/new.txt', '/w/taken.txt']);
    });

    it('replaces a file with an empty one and can restore the original', async () => {
        const fs = installMemoryWorkspaceFs({ '/w/a.txt': 'old' });

        const backup = await adapter.replaceWithEmptyFile(at('/w/a.txt'));
        expect(fs.read('/w/a.txt')).toBe('');
        expect(adapter.relative(at('/w'), backup)).toMatch(
            /^\.a\.txt\.[0-9a-f]{12}\.backup\.folder-structure-pro$/,
        );

        await adapter.restoreFile(backup, at('/w/a.txt'));
        expect(fs.read('/w/a.txt')).toBe('old');
        expect([...fs.nodes.keys()].sort()).toEqual(['/', '/w', '/w/a.txt']);
    });

    it('moves a discarded backup to the trash, so it stays recoverable', async () => {
        const fs = installMemoryWorkspaceFs({ '/w/a.txt': 'old' });
        const backup = await adapter.replaceWithEmptyFile(at('/w/a.txt'));
        await adapter.discardBackup(backup);
        expect(fs.trashed).toHaveLength(1);
        expect(fs.trashed[0]).toMatch(/^\/w\/\.a\.txt\..*\.folder-structure-pro$/);
    });

    it('removes only regular files and only empty directories', async () => {
        const fs = installMemoryWorkspaceFs({
            '/w/file.txt': 'x',
            '/w/empty': null,
            '/w/full/keep.txt': 'keep',
        });

        await adapter.removeFile(at('/w/file.txt'));
        await adapter.removeEmptyDirectory(at('/w/empty'));
        await expect(adapter.removeFile(at('/w/full'))).rejects.toThrow('Only a regular file');
        await expect(adapter.removeEmptyDirectory(at('/w/full'))).rejects.toThrow('not empty');
        await expect(adapter.removeEmptyDirectory(at('/w/full/keep.txt'))).rejects.toThrow(
            'Only a directory',
        );

        expect(fs.read('/w/full/keep.txt')).toBe('keep');
        expect(fs.nodes.has('/w/file.txt')).toBe(false);
        expect(fs.nodes.has('/w/empty')).toBe(false);
        expect(fs.trashed).toEqual([]);
    });

    it('refuses to replace a directory', async () => {
        installMemoryWorkspaceFs({ '/w/folder': null });
        await expect(adapter.replaceWithEmptyFile(at('/w/folder'))).rejects.toThrow(
            'Only a regular file can be replaced.',
        );
    });

    it('cleans up the temporary file when the final rename fails', async () => {
        const fs = installMemoryWorkspaceFs({ '/w': null });
        mockFsRename.mockImplementationOnce(async () => {
            throw Object.assign(new Error('denied'), { code: 'NoPermissions' });
        });
        await expect(adapter.createFileExclusive(at('/w/a.txt'), '')).rejects.toMatchObject({
            code: 'PERMISSION_DENIED',
        });
        expect([...fs.nodes.keys()].sort()).toEqual(['/', '/w']);
    });

    it('puts the original back when emptying it fails, leaving no copy behind', async () => {
        const fs = installMemoryWorkspaceFs({ '/w/a.txt': 'old' });
        mockFsWriteFile.mockImplementationOnce(async () => {
            throw Object.assign(new Error('read-only'), { code: 'NoPermissions' });
        });
        await expect(adapter.replaceWithEmptyFile(at('/w/a.txt'))).rejects.toMatchObject({
            code: 'PERMISSION_DENIED',
        });
        expect(fs.read('/w/a.txt')).toBe('old');
        expect([...fs.nodes.keys()].sort()).toEqual(['/', '/w', '/w/a.txt']);
    });

    it('reports both the original failure and cleanup failure', async () => {
        installMemoryWorkspaceFs({ '/w/a.txt': 'old' });

        const denied = () => Object.assign(new Error('denied'), { code: 'NoPermissions' });

        // createFileExclusive: rename fails, then temporary-file cleanup fails.
        mockFsRename.mockImplementationOnce(async () => {
            throw denied();
        });

        mockFsDelete.mockImplementationOnce(async () => {
            throw new Error('cleanup failed too');
        });

        const creationError = await adapter
            .createFileExclusive(at('/w/b.txt'), '')
            .catch((error: unknown) => error);

        expect(creationError).toMatchObject({
            code: 'IO_ERROR',
            message: expect.stringContaining('temporary file could not be cleaned up'),
        });

        const creationCause = (creationError as { cause?: unknown }).cause;

        expect(creationCause).toBeInstanceOf(AggregateError);
        expect(
            (creationCause as AggregateError).errors.map((error) => (error as Error).message),
        ).toEqual(['denied', 'cleanup failed too']);

        // replaceWithEmptyFile: writing fails, then restoring the backup fails.
        mockFsWriteFile.mockImplementationOnce(async () => {
            throw denied();
        });

        mockFsRename.mockImplementationOnce(async () => {
            throw new Error('restore failed too');
        });

        const replacementError = await adapter
            .replaceWithEmptyFile(at('/w/a.txt'))
            .catch((error: unknown) => error);

        expect(replacementError).toMatchObject({
            code: 'IO_ERROR',
            message: expect.stringContaining('automatic restoration also failed'),
        });

        const replacementCause = (replacementError as { cause?: unknown }).cause;

        expect(replacementCause).toBeInstanceOf(AggregateError);
        expect(
            (replacementCause as AggregateError).errors.map((error) => (error as Error).message),
        ).toEqual(['denied', 'restore failed too']);
    });

    it('runs the shared core all or nothing through the VS Code file system', async () => {
        const fs = installMemoryWorkspaceFs({
            '/w/existing.txt': 'old',
            '/w/keep/inside.txt': 'mine',
        });
        const before = fs.snapshot();
        const plan = await planStructureCreation(adapter, at('/w'), {
            app: { a: 'ts', b: 'ts', c: 'ts' },
            existing: 'txt',
            keep: { more: 'md' },
        });
        let writes = 0;
        const realWrite = mockFsWriteFile.getMockImplementation()!;
        mockFsWriteFile.mockImplementation(async (...args) => {
            if (++writes === 4) {
                throw Object.assign(new Error('disk full'), { code: 'Unavailable' });
            }
            return realWrite(...args);
        });

        const error = await executeStructureCreation(adapter, plan, 'replace').catch(
            (caught: unknown) => caught,
        );

        expect(error).toBeInstanceOf(StructureCreationExecutionError);
        expect((error as StructureCreationExecutionError).notUndone).toEqual([]);
        expect(fs.snapshot()).toEqual(before);
    });

    it('creates the whole structure and sends replaced originals to the trash', async () => {
        const fs = installMemoryWorkspaceFs({ '/w/existing.txt': 'old' });
        const plan = await planStructureCreation(adapter, at('/w'), {
            app: { index: 'ts' },
            existing: 'txt',
        });

        const result = await executeStructureCreation(adapter, plan, 'replace');

        expect(result).toMatchObject({
            directoriesCreated: 1,
            filesCreated: 1,
            filesReplaced: 1,
            leftoverBackups: [],
        });
        expect(fs.read('/w/app/index.ts')).toBe('');
        expect(fs.read('/w/existing.txt')).toBe('');
        expect(fs.trashed).toHaveLength(1);
        expect(
            [...fs.nodes.keys()].filter((path) => path.includes('folder-structure-pro')),
        ).toEqual([]);
    });
});
