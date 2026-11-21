import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
    lstat: vi.fn(),
    open: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs/promises', () => fsMocks);

import { NodeFileSystemAdapter } from '../src/adapters/nodeFileSystem.js';

const adapter = new NodeFileSystemAdapter();
const folderPath = adapter.toFolderPath('/synthetic/path');

function nodeError(code: string): NodeJS.ErrnoException {
    return Object.assign(new Error(code), { code });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('NodeFileSystemAdapter error handling', () => {
    it.each([
        ['ENOENT', 'NOT_FOUND'],
        ['ENOTDIR', 'NOT_DIRECTORY'],
        ['EACCES', 'PERMISSION_DENIED'],
        ['EPERM', 'PERMISSION_DENIED'],
        ['EEXIST', 'ALREADY_EXISTS'],
        ['EINVAL', 'INVALID_PATH'],
        ['ENAMETOOLONG', 'INVALID_PATH'],
        ['EIO', 'IO_ERROR'],
    ] as const)('normalizes %s to %s', async (systemCode, expectedCode) => {
        const cause = nodeError(systemCode);
        fsMocks.lstat.mockRejectedValueOnce(cause);

        await expect(adapter.lstat(folderPath)).rejects.toMatchObject({
            code: expectedCode,
            cause,
        });
    });

    it('does not report permission or arbitrary I/O errors as missing', async () => {
        fsMocks.lstat.mockRejectedValueOnce(nodeError('EACCES'));
        await expect(adapter.exists(folderPath)).rejects.toMatchObject({
            code: 'PERMISSION_DENIED',
        });

        fsMocks.lstat.mockRejectedValueOnce(nodeError('CUSTOM_IO_ERROR'));
        await expect(adapter.exists(folderPath)).rejects.toMatchObject({
            code: 'IO_ERROR',
        });
    });

    it('falls back to lstat when directory-entry type information is inconclusive', async () => {
        const inconclusiveEntry = {
            name: 'special',
            isFile: () => false,
            isDirectory: () => false,
            isSymbolicLink: () => false,
        };
        fsMocks.readdir.mockResolvedValueOnce([inconclusiveEntry]);
        fsMocks.lstat.mockResolvedValueOnce({
            isFile: () => false,
            isDirectory: () => false,
            isSymbolicLink: () => false,
        });

        await expect(adapter.readDirectory(folderPath)).resolves.toEqual([
            { name: 'special', metadata: { kind: 'unknown', symlink: 'not-a-symlink' } },
        ]);
        expect(fsMocks.lstat).toHaveBeenCalledOnce();
    });

    it('closes the exclusively created file handle when writing fails', async () => {
        const writeError = nodeError('EIO');
        const fileHandle = {
            writeFile: vi.fn().mockRejectedValue(writeError),
            close: vi.fn().mockResolvedValue(undefined),
        };
        fsMocks.open.mockResolvedValueOnce(fileHandle);

        await expect(adapter.createFileExclusive(folderPath, 'content')).rejects.toMatchObject({
            code: 'IO_ERROR',
            cause: writeError,
        });
        expect(fileHandle.writeFile).toHaveBeenCalledOnce();
        expect(fileHandle.close).toHaveBeenCalledOnce();
        expect(fsMocks.unlink).toHaveBeenCalledWith(folderPath);
    });

    it('preserves the write error and adds cleanup failure context', async () => {
        const writeError = nodeError('EIO');
        const cleanupError = nodeError('EACCES');
        const fileHandle = {
            writeFile: vi.fn().mockRejectedValue(writeError),
            close: vi.fn().mockResolvedValue(undefined),
        };
        fsMocks.open.mockResolvedValueOnce(fileHandle);
        fsMocks.unlink.mockRejectedValueOnce(cleanupError);

        const error = await adapter
            .createFileExclusive(folderPath, 'content')
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(AggregateError);
        if (!(error instanceof AggregateError)) {
            throw new Error('Expected write and cleanup failures to be aggregated.');
        }
        expect(error.errors[0]).toMatchObject({
            code: 'IO_ERROR',
            cause: writeError,
        });
        expect(error.errors[1]).toMatchObject({
            code: 'PERMISSION_DENIED',
            cause: cleanupError,
        });
        expect(error.cause).toBe(error.errors[0]);
        expect(error.message).toContain('EACCES');
    });
});
