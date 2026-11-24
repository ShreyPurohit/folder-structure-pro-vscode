import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import {
    FolderFileSystemError,
    type CreationRollback,
    type DirectoryEntry,
    type ExclusiveFileCreation,
    type EntryMetadata,
    type FolderFileSystemErrorCode,
    type FolderPath,
    type FolderStructureFileSystem,
} from '@folder-structure-pro/core';

const FOLDER_PATH_PREFIX = 'vscode-uri:v1:';
const URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*$/;

const FILE_SYSTEM_ERROR_CODES: Record<string, FolderFileSystemErrorCode> = {
    FileNotFound: 'NOT_FOUND',
    ENOENT: 'NOT_FOUND',
    FileNotADirectory: 'NOT_DIRECTORY',
    ENOTDIR: 'NOT_DIRECTORY',
    FileExists: 'ALREADY_EXISTS',
    EEXIST: 'ALREADY_EXISTS',
    NoPermissions: 'PERMISSION_DENIED',
    EACCES: 'PERMISSION_DENIED',
    EPERM: 'PERMISSION_DENIED',
    InvalidPath: 'INVALID_PATH',
    EINVAL: 'INVALID_PATH',
    ENAMETOOLONG: 'INVALID_PATH',
    Unavailable: 'IO_ERROR',
    Unknown: 'IO_ERROR',
};

/**
 * Adapts the VS Code filesystem API without converting workspace URIs to local paths.
 * FolderPath is a versioned prefix plus the percent-encoded Uri.toString() value,
 * preserving scheme, authority, path, query and fragment. Provider metadata is
 * provider-dependent; workspace.fs.stat is not equivalent to native lstat. A
 * provider may also reject URI query or fragment components for filesystem calls.
 */
export class VSCodeFileSystemAdapter
    implements FolderStructureFileSystem, ExclusiveFileCreation, CreationRollback
{
    /**
     * Converts a VS Code URI at the extension boundary into the adapter's opaque path.
     */
    toFolderPath(uri: vscode.Uri): FolderPath {
        return this.serializeUri(uri);
    }

    async readDirectory(path: FolderPath): Promise<DirectoryEntry[]> {
        return this.withUri(path, async (uri) => {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries.map(([name, type]) => ({
                name,
                metadata: this.metadataFromFileType(type),
            }));
        });
    }

    async readText(path: FolderPath): Promise<string> {
        return this.withUri(path, async (uri) => {
            const contents = await vscode.workspace.fs.readFile(uri);
            return new TextDecoder('utf-8').decode(contents);
        });
    }

    async lstat(path: FolderPath): Promise<EntryMetadata> {
        // Only the provider's FileType flags can indicate a link; there is no native no-follow stat here.
        return this.withUri(path, async (uri) => {
            const stat = await vscode.workspace.fs.stat(uri);
            return this.metadataFromFileType(stat.type);
        });
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

    /**
     * Accepts an already existing directory. The stat/create sequence is not atomic.
     */
    async createDirectory(path: FolderPath): Promise<void> {
        try {
            const metadata = await this.lstat(path);
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

        await this.withUri(path, (uri) => vscode.workspace.fs.createDirectory(uri));
    }

    async writeText(path: FolderPath, content: string): Promise<void> {
        await this.withUri(path, (uri) =>
            vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content)),
        );
    }

    /**
     * workspace.fs.writeFile cannot refuse to overwrite, so the empty file is written under a
     * random name next to the target and then renamed without overwriting.
     */

    async createFileExclusive(path: FolderPath, content: string): Promise<void> {
        const target = this.deserializePath(path);
        const temporary = this.siblingWithRandomName(target, 'new');

        try {
            await this.withUri(path, () =>
                vscode.workspace.fs.writeFile(temporary, new TextEncoder().encode(content)),
            );

            await this.withUri(path, () =>
                vscode.workspace.fs.rename(temporary, target, { overwrite: false }),
            );
        } catch (error) {
            let cleanupError: FolderFileSystemError | undefined;

            try {
                await this.withUri(path, () =>
                    vscode.workspace.fs.delete(temporary, {
                        recursive: false,
                        useTrash: false,
                    }),
                );
            } catch (caught) {
                const normalized = this.normalizeError(caught);

                if (normalized.code !== 'NOT_FOUND') {
                    cleanupError = normalized;
                }
            }

            if (cleanupError) {
                throw new FolderFileSystemError(
                    'IO_ERROR',
                    `File creation failed, and its temporary file could not be cleaned up: "${temporary.toString()}".`,
                    {
                        cause: new AggregateError([error, cleanupError]),
                    },
                );
            }

            throw error;
        }
    }

    /** Copies the original aside, then empties it in place so its permissions are kept. */
    async replaceWithEmptyFile(path: FolderPath): Promise<FolderPath> {
        const target = this.deserializePath(path);

        await this.assertRegularFile(path, 'Only a regular file can be replaced.');

        const backup = this.siblingWithRandomName(target, 'backup');

        // Create a backup before modifying the original file.
        try {
            await this.withUri(path, () =>
                vscode.workspace.fs.copy(target, backup, { overwrite: false }),
            );
        } catch (copyError) {
            let cleanupError: FolderFileSystemError | undefined;

            // A provider might create a partial backup before reporting failure.
            try {
                await this.withUri(path, () =>
                    vscode.workspace.fs.delete(backup, {
                        recursive: false,
                        useTrash: false,
                    }),
                );
            } catch (caught) {
                const normalized = this.normalizeError(caught);

                if (normalized.code !== 'NOT_FOUND') {
                    cleanupError = normalized;
                }
            }

            if (cleanupError) {
                throw new FolderFileSystemError(
                    'IO_ERROR',
                    `Backing up the original file failed, and the partial backup could not be cleaned up: "${backup.toString()}".`,
                    {
                        cause: new AggregateError([copyError, cleanupError]),
                    },
                );
            }

            throw copyError;
        }

        // Empty the original only after the backup has been created.
        try {
            await this.writeText(path, '');
        } catch (writeError) {
            try {
                // The failed write may have modified the original.
                await this.withUri(path, (uri) =>
                    vscode.workspace.fs.rename(backup, uri, { overwrite: true }),
                );
            } catch (restoreError) {
                throw new FolderFileSystemError(
                    'IO_ERROR',
                    `Replacing the file failed, and automatic restoration also failed. The original backup has been preserved at: "${backup.toString()}". Restore it manually if needed.`,
                    {
                        cause: new AggregateError([writeError, restoreError]),
                    },
                );
            }

            throw writeError;
        }

        return this.serializeUri(backup);
    }

    async restoreFile(backup: FolderPath, path: FolderPath): Promise<void> {
        const source = this.deserializePath(backup);
        await this.withUri(path, (target) =>
            vscode.workspace.fs.rename(source, target, { overwrite: true }),
        );
    }

    async removeFile(path: FolderPath): Promise<void> {
        await this.assertRegularFile(path, 'Only a regular file can be removed.');
        await this.withUri(path, (uri) =>
            vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false }),
        );
    }

    async removeEmptyDirectory(path: FolderPath): Promise<void> {
        const metadata = await this.lstat(path);
        if (metadata.kind !== 'directory') {
            throw new FolderFileSystemError('NOT_DIRECTORY', 'Only a directory can be removed.');
        }
        // Checked explicitly: whether a non-recursive delete refuses a non-empty folder
        // depends on the file system provider.
        if ((await this.readDirectory(path)).length > 0) {
            throw new FolderFileSystemError('IO_ERROR', 'The directory is not empty.');
        }
        await this.withUri(path, (uri) =>
            vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false }),
        );
    }

    /** Moves the original of a replaced file to the trash, so it can still be recovered. */
    async discardBackup(backup: FolderPath): Promise<void> {
        await this.withUri(backup, (uri) =>
            vscode.workspace.fs.delete(uri, { recursive: false, useTrash: true }),
        );
    }

    joinChild(parent: FolderPath, name: string): FolderPath {
        const parentUri = this.deserializePath(parent);
        const isWindowsFileUri = parentUri.scheme === 'file' && process.platform === 'win32';
        if (
            !name ||
            name === '.' ||
            name === '..' ||
            name.includes('/') ||
            name.includes('\0') ||
            (isWindowsFileUri && name.includes('\\'))
        ) {
            throw new FolderFileSystemError('INVALID_PATH', 'Invalid child path component.');
        }

        try {
            return this.serializeUri(vscode.Uri.joinPath(parentUri, name));
        } catch (error) {
            if (error instanceof FolderFileSystemError) {
                throw error;
            }
            throw new FolderFileSystemError('INVALID_PATH', 'Unable to join child path.', {
                cause: error,
            });
        }
    }

    relative(base: FolderPath, path: FolderPath): string {
        const baseUri = this.deserializePath(base);
        const targetUri = this.deserializePath(path);
        if (
            baseUri.scheme.toLowerCase() !== targetUri.scheme.toLowerCase() ||
            baseUri.authority !== targetUri.authority ||
            baseUri.query !== targetUri.query ||
            baseUri.fragment !== targetUri.fragment
        ) {
            throw new FolderFileSystemError(
                'INVALID_PATH',
                'Cannot compute a relative path across different URI identities.',
            );
        }

        const baseSegments = this.pathSegments(baseUri.path);
        const targetSegments = this.pathSegments(targetUri.path);
        let commonSegments = 0;
        while (
            commonSegments < baseSegments.length &&
            commonSegments < targetSegments.length &&
            baseSegments[commonSegments] === targetSegments[commonSegments]
        ) {
            commonSegments++;
        }

        return [
            ...Array.from({ length: baseSegments.length - commonSegments }, () => '..'),
            ...targetSegments.slice(commonSegments),
        ].join('/');
    }

    basename(path: FolderPath): string {
        const uri = this.deserializePath(path);
        const segments = this.pathSegments(uri.path);
        return segments[segments.length - 1] ?? uri.path;
    }

    private async assertRegularFile(path: FolderPath, message: string): Promise<void> {
        const metadata = await this.lstat(path);
        if (metadata.kind !== 'file') {
            throw new FolderFileSystemError('INVALID_PATH', message);
        }
    }

    /** A hidden name next to `uri` that nothing else uses. */
    private siblingWithRandomName(uri: vscode.Uri, purpose: string): vscode.Uri {
        const segments = this.pathSegments(uri.path);
        const name = segments.pop() ?? 'file';
        const hidden = `.${name}.${randomBytes(6).toString('hex')}.${purpose}.folder-structure-pro`;
        return uri.with({ path: `/${[...segments, hidden].join('/')}` });
    }

    private async withUri<T>(
        path: FolderPath,
        operation: (uri: vscode.Uri) => PromiseLike<T>,
    ): Promise<T> {
        const uri = this.deserializePath(path);
        try {
            return await operation(uri);
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    private metadataFromFileType(type: vscode.FileType): EntryMetadata {
        if ((type & vscode.FileType.SymbolicLink) !== 0) {
            return { kind: 'symlink', symlink: 'resolved-as-symlink' };
        }

        const isFile = (type & vscode.FileType.File) !== 0;
        const isDirectory = (type & vscode.FileType.Directory) !== 0;
        if (isFile === isDirectory) {
            return { kind: 'unknown', symlink: 'unknown' };
        }

        return {
            kind: isDirectory ? 'directory' : 'file',
            symlink: 'not-a-symlink',
        };
    }

    private serializeUri(uri: vscode.Uri): FolderPath {
        try {
            if (!URI_SCHEME_PATTERN.test(uri.scheme)) {
                throw new Error('URI has no valid scheme.');
            }
            return `${FOLDER_PATH_PREFIX}${encodeURIComponent(uri.toString())}` as FolderPath;
        } catch (error) {
            throw new FolderFileSystemError('INVALID_PATH', 'Unable to encode VS Code URI.', {
                cause: error,
            });
        }
    }

    private deserializePath(path: FolderPath): vscode.Uri {
        if (typeof path !== 'string' || !path.startsWith(FOLDER_PATH_PREFIX)) {
            throw new FolderFileSystemError('INVALID_PATH', 'Malformed encoded folder path.');
        }

        try {
            const serializedUri = decodeURIComponent(path.slice(FOLDER_PATH_PREFIX.length));
            const uri = vscode.Uri.parse(serializedUri, true);
            if (!URI_SCHEME_PATTERN.test(uri.scheme) || uri.toString() !== serializedUri) {
                throw new Error('URI serialization is not canonical.');
            }
            return uri;
        } catch (error) {
            throw new FolderFileSystemError('INVALID_PATH', 'Malformed encoded folder path.', {
                cause: error,
            });
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
            error instanceof Error ? error.message : 'VS Code filesystem operation failed.';

        return new FolderFileSystemError(code, message, { cause: error });
    }

    private pathSegments(path: string): string[] {
        return path.split('/').filter((segment) => segment.length > 0);
    }
}
