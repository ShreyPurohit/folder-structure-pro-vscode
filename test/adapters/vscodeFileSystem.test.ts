import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { FolderFileSystemError, type FolderPath } from '@folder-structure-pro/core';
import { VSCodeFileSystemAdapter } from '../../src/adapters/vscodeFileSystem';
import {
    mockFsCreateDirectory,
    mockFsReadDirectory,
    mockFsReadFile,
    mockFsStat,
    mockFsWriteFile,
    resetVscodeMocks,
} from '../__mocks__/vscode';

const adapter = new VSCodeFileSystemAdapter();

function providerError(code: string): Error & { code: string } {
    return Object.assign(new Error(code), { code });
}

describe('VSCodeFileSystemAdapter', () => {
    beforeEach(() => {
        resetVscodeMocks();
        vi.restoreAllMocks();
    });

    it('round-trips URI scheme, authority, path, query and fragment', async () => {
        const uri = vscode.Uri.from({
            scheme: 'vscode-remote',
            authority: 'ssh-remote+example',
            path: '/workspace/project',
            query: 'view=source',
            fragment: 'section',
        });
        mockFsStat.mockResolvedValue({ type: vscode.FileType.Directory });

        await expect(adapter.lstat(adapter.toFolderPath(uri))).resolves.toEqual({
            kind: 'directory',
            symlink: 'not-a-symlink',
        });
        expect(mockFsStat).toHaveBeenCalledWith(uri);
    });

    it('normalizes directory entry metadata and preserves unknown link status', async () => {
        mockFsReadDirectory.mockResolvedValue([
            ['file.txt', vscode.FileType.File],
            ['folder', vscode.FileType.Directory],
            ['link', vscode.FileType.File | vscode.FileType.SymbolicLink],
            ['unknown', vscode.FileType.Unknown],
        ]);

        await expect(
            adapter.readDirectory(adapter.toFolderPath(vscode.Uri.file('/workspace'))),
        ).resolves.toEqual([
            { name: 'file.txt', metadata: { kind: 'file', symlink: 'not-a-symlink' } },
            { name: 'folder', metadata: { kind: 'directory', symlink: 'not-a-symlink' } },
            { name: 'link', metadata: { kind: 'symlink', symlink: 'resolved-as-symlink' } },
            { name: 'unknown', metadata: { kind: 'unknown', symlink: 'unknown' } },
        ]);
    });

    it('reports a provider-identified link as the entry kind, not its target kind', async () => {
        mockFsStat.mockResolvedValue({
            type: vscode.FileType.Directory | vscode.FileType.SymbolicLink,
        });

        await expect(
            adapter.lstat(adapter.toFolderPath(vscode.Uri.file('/workspace/link'))),
        ).resolves.toEqual({ kind: 'symlink', symlink: 'resolved-as-symlink' });
    });

    it('returns false only for not-found and propagates normalized provider errors', async () => {
        mockFsStat.mockRejectedValueOnce(providerError('FileNotFound'));
        await expect(
            adapter.exists(adapter.toFolderPath(vscode.Uri.file('/missing'))),
        ).resolves.toBe(false);

        mockFsStat.mockRejectedValueOnce(providerError('NoPermissions'));
        await expect(
            adapter.exists(adapter.toFolderPath(vscode.Uri.file('/restricted'))),
        ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    });

    it('reads and writes text through VS Code filesystem APIs', async () => {
        const uri = vscode.Uri.file('/workspace/readme.txt');
        const path = adapter.toFolderPath(uri);
        mockFsReadFile.mockResolvedValue(new TextEncoder().encode('hello'));

        await expect(adapter.readText(path)).resolves.toBe('hello');
        await adapter.writeText(path, 'updated');
        expect(mockFsReadFile).toHaveBeenCalledWith(uri);
        expect(mockFsWriteFile).toHaveBeenCalledWith(uri, new TextEncoder().encode('updated'));
    });

    it('accepts existing directories and creates missing directories', async () => {
        const existing = vscode.Uri.file('/workspace/existing');
        mockFsStat.mockResolvedValueOnce({ type: vscode.FileType.Directory });
        await adapter.createDirectory(adapter.toFolderPath(existing));
        expect(mockFsCreateDirectory).not.toHaveBeenCalled();

        const missing = vscode.Uri.file('/workspace/new');
        mockFsStat.mockRejectedValueOnce(providerError('FileNotFound'));
        await adapter.createDirectory(adapter.toFolderPath(missing));
        expect(mockFsCreateDirectory).toHaveBeenCalledWith(missing);
    });

    it('does not accept an existing non-directory as a directory', async () => {
        mockFsStat.mockResolvedValueOnce({ type: vscode.FileType.File });

        await expect(
            adapter.createDirectory(adapter.toFolderPath(vscode.Uri.file('/workspace/file'))),
        ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
        expect(mockFsCreateDirectory).not.toHaveBeenCalled();
    });

    it('rejects invalid child components without normalizing them', () => {
        const parent = adapter.toFolderPath(vscode.Uri.file('/workspace'));
        const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
        if (!platformDescriptor?.configurable) {
            throw new Error('The Node.js platform property cannot be stubbed in this test.');
        }

        Object.defineProperty(process, 'platform', { ...platformDescriptor, value: 'win32' });
        try {
            for (const name of ['', '.', '..', 'a/b', 'a\0b', 'a\\b']) {
                expect(() => adapter.joinChild(parent, name)).toThrow(
                    expect.objectContaining({ code: 'INVALID_PATH' }),
                );
            }
        } finally {
            Object.defineProperty(process, 'platform', platformDescriptor);
        }
    });

    it('joins one child and returns normalized relative paths and basenames', async () => {
        const root = vscode.Uri.from({
            scheme: 'vscode-remote',
            authority: 'ssh-remote+example',
            path: '/workspace/project',
        });
        const rootPath = adapter.toFolderPath(root);
        const childPath = adapter.joinChild(rootPath, 'src');
        mockFsReadDirectory.mockResolvedValue([]);

        await adapter.readDirectory(childPath);

        expect(mockFsReadDirectory).toHaveBeenCalledWith(vscode.Uri.joinPath(root, 'src'));
        expect(adapter.relative(rootPath, childPath)).toBe('src');
        expect(adapter.basename(childPath)).toBe('src');
    });

    it('rejects relative paths across URI identities and malformed encoded paths', async () => {
        const first = adapter.toFolderPath(vscode.Uri.file('/workspace/a'));
        const second = adapter.toFolderPath(
            vscode.Uri.from({ scheme: 'vscode-remote', authority: 'host', path: '/workspace/a' }),
        );
        expect(() => adapter.relative(first, second)).toThrow(
            expect.objectContaining({ code: 'INVALID_PATH' }),
        );

        await expect(adapter.lstat('not-an-encoded-path' as FolderPath)).rejects.toMatchObject({
            code: 'INVALID_PATH',
        });
        await expect(adapter.lstat('vscode-uri:v1:%' as FolderPath)).rejects.toBeInstanceOf(
            FolderFileSystemError,
        );
    });

    it('maps unknown provider errors to IO_ERROR and preserves their cause', async () => {
        const cause = providerError('ProviderSpecificFailure');
        mockFsStat.mockRejectedValueOnce(cause);

        await expect(
            adapter.lstat(adapter.toFolderPath(vscode.Uri.file('/workspace/file'))),
        ).rejects.toMatchObject({
            code: 'IO_ERROR',
            cause,
        });
    });
});
