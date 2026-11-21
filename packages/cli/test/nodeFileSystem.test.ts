import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FolderFileSystemError } from '@folder-structure-pro/core';
import { NodeFileSystemAdapter } from '../src/adapters/nodeFileSystem.js';

const adapter = new NodeFileSystemAdapter();
let temporaryDirectory: string | undefined;

async function createTemporaryDirectory(): Promise<string> {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-structure-cli-'));
    return temporaryDirectory;
}

afterEach(async () => {
    vi.restoreAllMocks();
    if (temporaryDirectory) {
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
        temporaryDirectory = undefined;
    }
});

describe('NodeFileSystemAdapter', () => {
    it('reports files, directories, and symbolic links without following links', async ({
        skip,
    }) => {
        const root = await createTemporaryDirectory();
        const filePath = path.join(root, 'file.txt');
        const directoryPath = path.join(root, 'directory');
        const linkPath = path.join(root, 'link');
        await fs.writeFile(filePath, 'content');
        await fs.mkdir(directoryPath);

        try {
            await fs.symlink(filePath, linkPath, 'file');
        } catch (error) {
            const code =
                typeof error === 'object' && error !== null && 'code' in error
                    ? error.code
                    : undefined;
            if (code === 'EPERM' || code === 'EACCES' || code === 'ENOTSUP') {
                skip(`Symbolic links are unavailable in this environment (${String(code)}).`);
            }
            throw error;
        }

        const entries = await adapter.readDirectory(adapter.toFolderPath(root));
        expect(entries).toEqual(
            expect.arrayContaining([
                { name: 'file.txt', metadata: { kind: 'file', symlink: 'not-a-symlink' } },
                { name: 'directory', metadata: { kind: 'directory', symlink: 'not-a-symlink' } },
                { name: 'link', metadata: { kind: 'symlink', symlink: 'resolved-as-symlink' } },
            ]),
        );
        await expect(adapter.lstat(adapter.toFolderPath(linkPath))).resolves.toEqual({
            kind: 'symlink',
            symlink: 'resolved-as-symlink',
        });
    });

    it('returns false only when a path is missing', async () => {
        const root = await createTemporaryDirectory();
        const missingPath = adapter.toFolderPath(path.join(root, 'missing'));

        await expect(adapter.exists(missingPath)).resolves.toBe(false);
        await expect(adapter.lstat(missingPath)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('creates directories recursively and accepts existing directories', async () => {
        const root = await createTemporaryDirectory();
        const nestedPath = adapter.toFolderPath(path.join(root, 'nested', 'directory'));

        await adapter.createDirectory(nestedPath);
        await adapter.createDirectory(nestedPath);

        const stats = await fs.stat(nestedPath);
        expect(stats.isDirectory()).toBe(true);
        await expect(adapter.createDirectory(adapter.toFolderPath(root))).resolves.toBeUndefined();
    });

    it('rejects an existing file as a directory', async () => {
        const root = await createTemporaryDirectory();
        const filePath = path.join(root, 'file');
        await fs.writeFile(filePath, '');

        await expect(adapter.createDirectory(adapter.toFolderPath(filePath))).rejects.toMatchObject(
            {
                code: 'ALREADY_EXISTS',
            },
        );
    });

    it('reads and overwrites UTF-8 text', async () => {
        const root = await createTemporaryDirectory();
        const filePath = path.join(root, 'text.txt');
        const folderPath = adapter.toFolderPath(filePath);

        await adapter.writeText(folderPath, 'first');
        await expect(adapter.readText(folderPath)).resolves.toBe('first');
        await adapter.writeText(folderPath, 'second');
        await expect(adapter.readText(folderPath)).resolves.toBe('second');
    });

    it('rejects invalid child components and respects platform separators', async () => {
        const root = adapter.toFolderPath(await createTemporaryDirectory());
        for (const name of ['', '.', '..', 'a/b', 'a\0b']) {
            expect(() => adapter.joinChild(root, name)).toThrow(
                expect.objectContaining({ code: 'INVALID_PATH' }),
            );
        }

        if (path.sep === '\\') {
            expect(() => adapter.joinChild(root, 'a\\b')).toThrow(
                expect.objectContaining({ code: 'INVALID_PATH' }),
            );
            expect(() => adapter.joinChild(root, 'C:relative')).toThrow(
                expect.objectContaining({ code: 'INVALID_PATH' }),
            );
        } else {
            expect(adapter.joinChild(root, 'a\\b')).toBe(path.join(root, 'a\\b'));
        }
    });

    it('returns normalized relative paths and basenames', async () => {
        const root = await createTemporaryDirectory();
        const rootPath = adapter.toFolderPath(root);
        const childPath = adapter.joinChild(rootPath, 'nested');

        expect(adapter.relative(rootPath, childPath)).toBe('nested');
        expect(adapter.relative(childPath, rootPath)).toBe('..');
        expect(adapter.relative(rootPath, rootPath)).toBe('');
        expect(adapter.basename(childPath)).toBe('nested');
    });

    it.skipIf(path.sep !== '\\')('rejects relative paths across Windows drives', () => {
        const firstDrive = adapter.toFolderPath('C:\\workspace');
        const secondDrive = adapter.toFolderPath('D:\\workspace');
        expect(() => adapter.relative(firstDrive, secondDrive)).toThrow(
            expect.objectContaining({ code: 'INVALID_PATH' }),
        );
    });

    it('creates files exclusively and preserves existing contents on collision', async () => {
        const root = await createTemporaryDirectory();
        const filePath = adapter.toFolderPath(path.join(root, 'exclusive.txt'));

        await adapter.createFileExclusive(filePath, 'created');
        await expect(adapter.readText(filePath)).resolves.toBe('created');
        await expect(adapter.createFileExclusive(filePath, 'replacement')).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
        });
        await expect(adapter.readText(filePath)).resolves.toBe('created');
    });

    it('removes the incomplete file after an actual exclusive-create write failure', async () => {
        const root = await createTemporaryDirectory();
        const probeHandle = await fs.open(path.join(root, 'probe'), 'w');
        const fileHandlePrototype = Object.getPrototypeOf(probeHandle);
        await probeHandle.close();

        const writeError = new Error('Write failed.');
        vi.spyOn(fileHandlePrototype, 'writeFile').mockRejectedValue(writeError);
        const filePath = path.join(root, 'incomplete.txt');

        await expect(
            adapter.createFileExclusive(adapter.toFolderPath(filePath), 'content'),
        ).rejects.toMatchObject({
            code: 'IO_ERROR',
            cause: writeError,
        });

        await expect(fs.lstat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
    });
});
