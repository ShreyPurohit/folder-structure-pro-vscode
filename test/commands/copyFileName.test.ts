import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { copyFileName } from '../../src/commands/copyFileName';
import { FileSystemService } from '../../src/services/fileSystem';
import { resetVscodeMocks } from '../__mocks__/vscode';

describe('copyFileName command', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('copies the basename of a local file', async () => {
        const target = vscode.Uri.file('/workspace/src/index.ts');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(false);

        await copyFileName(target);

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('index.ts');
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('uses the active editor uri when no uri is provided', async () => {
        const target = vscode.Uri.file('/workspace/README.md');
        vscode.window.activeTextEditor = {
            document: { uri: target },
            selection: { active: { line: 0, character: 0 } },
        };
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(false);

        await copyFileName(undefined as unknown as vscode.Uri);

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('README.md');
    });

    it('rejects non-file schemes', async () => {
        const target = new vscode.Uri('untitled', '', '/Untitled-1', '', '');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(false);

        await copyFileName(target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('only supported for local files'),
        );
    });

    it('rejects directories and missing targets', async () => {
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        await copyFileName(vscode.Uri.file('/workspace/folder'));

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Invalid file selected'),
        );

        await copyFileName(undefined as unknown as vscode.Uri);
        expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(2);
    });
});
