import * as path from 'node:path';
import { FolderFileSystemError, type FolderPath } from '@folder-structure-pro/core';
import { NodeFileSystemAdapter } from './nodeFileSystem.js';

export type OverwriteConfirmation = (filePath: string) => Promise<boolean>;

export async function exportStructure(
    fileSystem: NodeFileSystemAdapter,
    requestedPath: string,
    cwd: string,
    content: string,
    confirmOverwrite: OverwriteConfirmation,
): Promise<string> {
    const absolutePath = path.resolve(cwd, requestedPath);
    const filePath = fileSystem.toFolderPath(absolutePath);
    const parentPath = fileSystem.toFolderPath(path.dirname(absolutePath));
    const parentMetadata = await fileSystem.lstat(parentPath);
    if (parentMetadata.kind !== 'directory' || parentMetadata.symlink !== 'not-a-symlink') {
        throw new FolderFileSystemError(
            'NOT_DIRECTORY',
            'The output parent must be an existing, non-symbolic-link directory.',
        );
    }

    let existing = await existingFileMetadata(fileSystem, filePath);
    if (existing && !(await confirmOverwrite(absolutePath))) {
        return 'cancelled';
    }

    if (!existing) {
        try {
            await fileSystem.createFileExclusive(filePath, content);
            return absolutePath;
        } catch (error) {
            if (!(error instanceof FolderFileSystemError) || error.code !== 'ALREADY_EXISTS') {
                throw error;
            }
            existing = await existingFileMetadata(fileSystem, filePath);
            if (!existing) {
                throw error;
            }
            if (!(await confirmOverwrite(absolutePath))) {
                return 'cancelled';
            }
        }
    }

    await fileSystem.writeText(filePath, content);
    return absolutePath;
}

async function existingFileMetadata(
    fileSystem: NodeFileSystemAdapter,
    filePath: FolderPath,
): Promise<boolean> {
    try {
        const metadata = await fileSystem.lstat(filePath);
        if (metadata.kind !== 'file' || metadata.symlink !== 'not-a-symlink') {
            throw new FolderFileSystemError(
                'INVALID_PATH',
                'The output path exists but is not a regular, non-symbolic-link file.',
            );
        }
        return true;
    } catch (error) {
        if (error instanceof FolderFileSystemError && error.code === 'NOT_FOUND') {
            return false;
        }
        throw error;
    }
}
