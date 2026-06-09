import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { FileSystemService } from '../../src/services/fileSystem';
import { resetVscodeMocks } from '../__mocks__/vscode';

describe('FileSystemService', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('checks existence and directory type for string and Uri inputs', async () => {
        const uri = vscode.Uri.file('/tmp/project');
        vscode.workspace.fs.stat.mockResolvedValue({ type: vscode.FileType.Directory });
        await expect(FileSystemService.exists('/tmp/project')).resolves.toBe(true);
        await expect(FileSystemService.isDirectory(uri)).resolves.toBe(true);

        vscode.workspace.fs.stat.mockRejectedValue(new Error('missing'));
        await expect(FileSystemService.exists(uri)).resolves.toBe(false);
        await expect(FileSystemService.isDirectory('/missing')).resolves.toBe(false);
    });

    it('reads and writes files', async () => {
        const uri = vscode.Uri.file('/tmp/readme.md');
        vscode.workspace.fs.readFile.mockResolvedValueOnce(new TextEncoder().encode('hello'));
        await expect(FileSystemService.readFile(uri)).resolves.toBe('hello');

        await FileSystemService.writeFile(uri, 'updated');
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
            uri,
            new TextEncoder().encode('updated'),
        );
    });

    it('skips write when file already exists', async () => {
        const uri = vscode.Uri.file('/tmp/existing.txt');
        vscode.workspace.fs.stat.mockResolvedValueOnce({ type: vscode.FileType.File });
        await FileSystemService.writeFileIfAbsent(uri, 'content');
        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });

    it('writes file when absent', async () => {
        const uri = vscode.Uri.file('/tmp/new.txt');
        vscode.workspace.fs.stat.mockRejectedValueOnce(new Error('missing'));
        await FileSystemService.writeFileIfAbsent(uri, 'content');
        expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
            uri,
            new TextEncoder().encode('content'),
        );
    });

    it('creates directories and reads entries', async () => {
        const uri = vscode.Uri.file('/tmp/project');
        await FileSystemService.mkdir(uri);
        await FileSystemService.mkdirIfAbsent(uri);
        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledTimes(2);

        vscode.workspace.fs.readDirectory.mockResolvedValueOnce([
            ['src', vscode.FileType.Directory],
            ['index.ts', vscode.FileType.File],
        ]);
        await expect(FileSystemService.readdir(uri)).resolves.toEqual([
            { name: 'src', type: vscode.FileType.Directory },
            { name: 'index.ts', type: vscode.FileType.File },
        ]);
    });

    it('deletes paths with default options', async () => {
        const uri = vscode.Uri.file('/tmp/remove');
        await FileSystemService.delete(uri);
        expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(uri, {
            recursive: true,
            useTrash: true,
        });
    });
});
