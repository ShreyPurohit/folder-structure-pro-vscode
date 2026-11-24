import { beforeEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { FileSystemService } from '../../src/services/fileSystem';
import { resetVscodeMocks } from '../__mocks__/vscode';

describe('FileSystemService', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('checks directory type for string and Uri inputs', async () => {
        const uri = vscode.Uri.file('/tmp/project');
        vscode.workspace.fs.stat.mockResolvedValue({ type: vscode.FileType.Directory });
        await expect(FileSystemService.isDirectory(uri)).resolves.toBe(true);
        await expect(FileSystemService.isDirectory('/tmp/project')).resolves.toBe(true);

        vscode.workspace.fs.stat.mockResolvedValue({ type: vscode.FileType.File });
        await expect(FileSystemService.isDirectory(uri)).resolves.toBe(false);

        vscode.workspace.fs.stat.mockRejectedValue(new Error('missing'));
        await expect(FileSystemService.isDirectory('/missing')).resolves.toBe(false);
    });
});
