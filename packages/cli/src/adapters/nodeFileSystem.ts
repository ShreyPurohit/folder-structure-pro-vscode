import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';
import * as path from 'node:path';
import {
    FolderFileSystemError,
    type CreationRollback,
    type DirectoryEntry,
    type EntryMetadata,
    type ExclusiveFileCreation,
    type FolderFileSystemErrorCode,
    type FolderPath,
    type FolderStructureFileSystem,
} from '@folder-structure-pro/core';

const FILE_SYSTEM_ERROR_CODES: Record<string, FolderFileSystemErrorCode> = {
    ENOENT: 'NOT_FOUND',
    ENOTDIR: 'NOT_DIRECTORY',
    EACCES: 'PERMISSION_DENIED',
    EPERM: 'PERMISSION_DENIED',
    EEXIST: 'ALREADY_EXISTS',
    EINVAL: 'INVALID_PATH',
    ENAMETOOLONG: 'INVALID_PATH',
};

export class NodeFileSystemAdapter
    implements FolderStructureFileSystem, ExclusiveFileCreation, CreationRollback
{
    toFolderPath(value: string): FolderPath {
        try {
            if (typeof value !== 'string' || !value || value.includes('\0')) {
                throw new FolderFileSystemError(
                    'INVALID_PATH',
                    'Filesystem path must be a non-empty path without NUL characters.',
                );
            }
            return path.resolve(value) as FolderPath;
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    async readDirectory(folderPath: FolderPath): Promise<DirectoryEntry[]> {
        const directoryPath = this.decodePath(folderPath);
        const entries = await this.withNormalizedError(() =>
            fs.readdir(directoryPath, { withFileTypes: true }),
        );

        return Promise.all(
            entries.map(async (entry) => ({
                name: entry.name,
                metadata:
                    this.metadataFromDirent(entry) ??
                    (await this.lstat(this.joinChild(folderPath, entry.name))),
            })),
        );
    }

    async readText(folderPath: FolderPath): Promise<string> {
        return this.withNormalizedError(() =>
            fs.readFile(this.decodePath(folderPath), { encoding: 'utf8' }),
        );
    }

    async lstat(folderPath: FolderPath): Promise<EntryMetadata> {
        const stats = await this.withNormalizedError(() => fs.lstat(this.decodePath(folderPath)));
        return this.metadataFromStats(stats);
    }

    async exists(folderPath: FolderPath): Promise<boolean> {
        try {
            await this.lstat(folderPath);
            return true;
        } catch (error) {
            if (error instanceof FolderFileSystemError && error.code === 'NOT_FOUND') {
                return false;
            }
            throw error;
        }
    }

    async createDirectory(folderPath: FolderPath): Promise<void> {
        try {
            const metadata = await this.lstat(folderPath);
            if (metadata.kind === 'directory' && metadata.symlink === 'not-a-symlink') {
                return;
            }
            throw new FolderFileSystemError(
                'ALREADY_EXISTS',
                'A non-directory filesystem entry already exists at the target path.',
            );
        } catch (error) {
            if (!(error instanceof FolderFileSystemError) || error.code !== 'NOT_FOUND') {
                throw error;
            }
        }

        await this.withNormalizedError(() =>
            fs.mkdir(this.decodePath(folderPath), { recursive: true }),
        );
    }

    async writeText(folderPath: FolderPath, content: string): Promise<void> {
        await this.withNormalizedError(() =>
            fs.writeFile(this.decodePath(folderPath), content, { encoding: 'utf8' }),
        );
    }

    async createFileExclusive(folderPath: FolderPath, content: string): Promise<void> {
        const fileHandle = await this.withNormalizedError(() =>
            fs.open(this.decodePath(folderPath), 'wx'),
        );

        let writeFailed = false;
        let writeFailure: unknown;
        let closeFailed = false;
        let closeFailure: unknown;
        try {
            await fileHandle.writeFile(content, { encoding: 'utf8' });
        } catch (error) {
            writeFailed = true;
            writeFailure = error;
        } finally {
            try {
                await fileHandle.close();
            } catch (error) {
                closeFailed = true;
                closeFailure = error;
            }
        }

        if (!writeFailed) {
            if (closeFailed) {
                throw this.normalizeError(closeFailure);
            }
            return;
        }

        const normalizedWriteFailure = this.normalizeError(writeFailure);
        const additionalFailures: Error[] = [];
        const additionalContext: string[] = [];
        if (closeFailed) {
            const normalizedCloseFailure = this.normalizeError(closeFailure);
            additionalFailures.push(normalizedCloseFailure);
            additionalContext.push(
                `Closing the file also failed: ${normalizedCloseFailure.message}`,
            );
        }

        try {
            await fs.unlink(this.decodePath(folderPath));
        } catch (error) {
            const normalizedCleanupFailure = this.normalizeError(error);
            if (normalizedCleanupFailure.code !== 'NOT_FOUND') {
                additionalFailures.push(normalizedCleanupFailure);
                additionalContext.push(
                    `Removing the incomplete file also failed: ${normalizedCleanupFailure.message}`,
                );
            }
        }

        if (additionalFailures.length > 0) {
            throw new AggregateError(
                [normalizedWriteFailure, ...additionalFailures],
                `Writing the exclusively created file failed: ${normalizedWriteFailure.message}. ${additionalContext.join(' ')}`,
                { cause: normalizedWriteFailure },
            );
        }

        throw normalizedWriteFailure;
    }

    async replaceWithEmptyFile(folderPath: FolderPath): Promise<FolderPath> {
        const target = this.decodePath(folderPath);
        const stats = await this.withNormalizedError(() => fs.lstat(target));

        if (!stats.isFile()) {
            throw new FolderFileSystemError('INVALID_PATH', 'Only a regular file can be replaced.');
        }

        const backup = path.join(
            path.dirname(target),
            `.${path.basename(target)}.${randomBytes(6).toString('hex')}.folder-structure-pro`,
        );

        // Move the original aside. This is an atomic rename within the same directory.
        await this.withNormalizedError(() => fs.rename(target, backup));

        let replacementCreated = false;

        try {
            const handle = await this.withNormalizedError(() =>
                fs.open(target, 'wx', stats.mode & 0o7777),
            );

            replacementCreated = true;
            await handle.close();
        } catch (operationError) {
            const normalizedOperationError = this.normalizeError(operationError);
            const additionalFailures: Error[] = [];

            // Remove only the replacement file created by this operation.
            if (replacementCreated) {
                try {
                    await fs.unlink(target);
                } catch (cleanupError) {
                    const normalizedCleanupError = this.normalizeError(cleanupError);

                    if (normalizedCleanupError.code !== 'NOT_FOUND') {
                        additionalFailures.push(normalizedCleanupError);
                    }
                }
            }

            let restored = false;

            try {
                // link() fails if the target already exists; unlike rename(), it
                // will not overwrite a file created by another process.
                await fs.link(backup, target);
                restored = true;
            } catch (restoreError) {
                additionalFailures.push(this.normalizeError(restoreError));
            }

            if (restored) {
                try {
                    await fs.unlink(backup);
                } catch (cleanupError) {
                    additionalFailures.push(this.normalizeError(cleanupError));
                }
            }

            if (additionalFailures.length > 0) {
                throw new FolderFileSystemError(
                    'IO_ERROR',
                    restored
                        ? `Replacing the file failed. The original was restored, but backup cleanup also failed. Check the backup at: "${backup}".`
                        : `Replacing the file failed, and automatic restoration also failed. The original backup has been preserved at: "${backup}". Restore it manually if needed.`,
                    {
                        cause: new AggregateError([
                            normalizedOperationError,
                            ...additionalFailures,
                        ]),
                    },
                );
            }

            throw normalizedOperationError;
        }

        return backup as FolderPath;
    }

    async restoreFile(backup: FolderPath, folderPath: FolderPath): Promise<void> {
        const target = this.decodePath(folderPath);
        await this.withNormalizedError(() => fs.rm(target, { force: true }));
        await this.withNormalizedError(() => fs.rename(this.decodePath(backup), target));
    }

    async removeFile(folderPath: FolderPath): Promise<void> {
        const target = this.decodePath(folderPath);
        const stats = await this.withNormalizedError(() => fs.lstat(target));
        if (!stats.isFile()) {
            throw new FolderFileSystemError('INVALID_PATH', 'Only a regular file can be removed.');
        }
        await this.withNormalizedError(() => fs.unlink(target));
    }

    async discardBackup(backup: FolderPath): Promise<void> {
        await this.removeFile(backup);
    }

    async removeEmptyDirectory(folderPath: FolderPath): Promise<void> {
        // rmdir fails on a directory that is not empty, so nothing inside can be lost.
        await this.withNormalizedError(() => fs.rmdir(this.decodePath(folderPath)));
    }

    joinChild(parent: FolderPath, name: string): FolderPath {
        const parentPath = this.decodePath(parent);
        if (typeof name !== 'string') {
            throw new FolderFileSystemError('INVALID_PATH', 'Invalid child path component.');
        }

        const isWindows = path.sep === '\\';
        const hasWindowsRoot = isWindows && path.win32.parse(name).root.length > 0;
        if (
            !name ||
            name === '.' ||
            name === '..' ||
            name.includes('/') ||
            (isWindows && name.includes('\\')) ||
            name.includes('\0') ||
            path.isAbsolute(name) ||
            hasWindowsRoot
        ) {
            throw new FolderFileSystemError('INVALID_PATH', 'Invalid child path component.');
        }

        return path.join(parentPath, name) as FolderPath;
    }

    relative(base: FolderPath, target: FolderPath): string {
        const basePath = this.decodePath(base);
        const targetPath = this.decodePath(target);
        const baseRoot = path.parse(basePath).root;
        const targetRoot = path.parse(targetPath).root;
        const rootsMatch =
            path.sep === '\\'
                ? baseRoot.toLowerCase() === targetRoot.toLowerCase()
                : baseRoot === targetRoot;

        if (!rootsMatch) {
            throw new FolderFileSystemError(
                'INVALID_PATH',
                'Cannot compute a relative path across different filesystem roots.',
            );
        }

        const relativePath = path.relative(basePath, targetPath);
        if (path.isAbsolute(relativePath) || path.parse(relativePath).root) {
            throw new FolderFileSystemError(
                'INVALID_PATH',
                'The target path cannot be represented as a relative path from the base.',
            );
        }

        return relativePath.split(path.sep).join('/');
    }

    basename(folderPath: FolderPath): string {
        return path.basename(this.decodePath(folderPath));
    }

    private decodePath(folderPath: FolderPath): string {
        if (
            typeof folderPath !== 'string' ||
            !folderPath ||
            folderPath.includes('\0') ||
            !path.isAbsolute(folderPath)
        ) {
            throw new FolderFileSystemError('INVALID_PATH', 'Invalid absolute filesystem path.');
        }
        return folderPath;
    }

    private metadataFromDirent(entry: Dirent): EntryMetadata | undefined {
        if (entry.isSymbolicLink()) {
            return { kind: 'symlink', symlink: 'resolved-as-symlink' };
        }
        if (entry.isFile()) {
            return { kind: 'file', symlink: 'not-a-symlink' };
        }
        if (entry.isDirectory()) {
            return { kind: 'directory', symlink: 'not-a-symlink' };
        }
        return undefined;
    }

    private metadataFromStats(stats: Stats): EntryMetadata {
        if (stats.isSymbolicLink()) {
            return { kind: 'symlink', symlink: 'resolved-as-symlink' };
        }
        if (stats.isFile()) {
            return { kind: 'file', symlink: 'not-a-symlink' };
        }
        if (stats.isDirectory()) {
            return { kind: 'directory', symlink: 'not-a-symlink' };
        }
        return { kind: 'unknown', symlink: 'not-a-symlink' };
    }

    private async withNormalizedError<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    private normalizeError(error: unknown): FolderFileSystemError {
        if (error instanceof FolderFileSystemError) {
            return error;
        }

        const providerCode =
            typeof error === 'object' && error !== null && 'code' in error
                ? (error as { code?: unknown }).code
                : undefined;
        const code =
            typeof providerCode === 'string'
                ? (FILE_SYSTEM_ERROR_CODES[providerCode] ?? 'IO_ERROR')
                : 'IO_ERROR';
        const message =
            error instanceof Error ? error.message : 'Node filesystem operation failed.';

        return new FolderFileSystemError(code, message, { cause: error });
    }
}
