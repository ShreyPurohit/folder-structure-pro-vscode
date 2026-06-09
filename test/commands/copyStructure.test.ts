import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { copyStructure } from '../../src/commands/copyStructure';
import { StructureService } from '../../src/services/structure';
import { FileSystemService } from '../../src/services/fileSystem';
import { resetVscodeMocks } from '../__mocks__/vscode';

describe('copyStructure command', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('copies formatted structure from a selected directory', async () => {
        const target = vscode.Uri.file('/workspace/app');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vi.spyOn(StructureService, 'getStructure').mockResolvedValue({ app: { index: 'ts' } });
        vi.spyOn(StructureService, 'formatStructure').mockReturnValue(
            'Directory structure:\n└── app/',
        );

        await copyStructure(target);

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
            'Directory structure:\n└── app/',
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('prompts for a folder when the provided uri is not a directory', async () => {
        const picked = vscode.Uri.file('/workspace/picked');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vscode.window.showOpenDialog.mockResolvedValueOnce([picked]);
        vi.spyOn(StructureService, 'getStructure').mockResolvedValue({ picked: {} });
        vi.spyOn(StructureService, 'formatStructure').mockReturnValue('{}');

        await copyStructure(undefined as unknown as vscode.Uri);

        expect(vscode.window.showOpenDialog).toHaveBeenCalled();
        expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
    });

    it('shows an error when folder selection is cancelled', async () => {
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(false);
        vscode.window.showOpenDialog.mockResolvedValueOnce(undefined);

        await copyStructure(undefined as unknown as vscode.Uri);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Please select a valid folder'),
        );
    });

    it('shows an error when structure generation fails', async () => {
        const target = vscode.Uri.file('/workspace/app');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vi.spyOn(StructureService, 'getStructure').mockRejectedValue(new Error('boom'));

        await copyStructure(target);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('boom'),
        );
    });
});
