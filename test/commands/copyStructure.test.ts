import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
    copyStructure,
    copyStructureAsJson,
    copyStructureAsPlainText,
} from '../../src/commands/copyStructure';
import { JSON_OUTPUT_FORMAT, PLAIN_TEXT_OUTPUT_FORMAT } from '../../src/constants';
import { FileSystemService } from '../../src/services/fileSystem';
import { StructureService } from '../../src/services/structure';
import { resetVscodeMocks } from '../__mocks__/vscode';

describe('copyStructure command', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('copies formatted structure in the requested format', async () => {
        const target = vscode.Uri.file('/workspace/app');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vi.spyOn(StructureService, 'getStructure').mockResolvedValue({ app: { index: 'ts' } });
        vi.spyOn(StructureService, 'formatStructure').mockReturnValue(
            'Directory structure:\n└── app/',
        );

        await copyStructure(target, PLAIN_TEXT_OUTPUT_FORMAT);

        expect(StructureService.formatStructure).toHaveBeenCalledWith(
            { app: { index: 'ts' } },
            PLAIN_TEXT_OUTPUT_FORMAT,
        );
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
            'Directory structure:\n└── app/',
        );
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('uses plain text format via copyStructureAsPlainText', async () => {
        const target = vscode.Uri.file('/workspace/app');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vi.spyOn(StructureService, 'getStructure').mockResolvedValue({ app: {} });
        vi.spyOn(StructureService, 'formatStructure').mockReturnValue('plain');

        await copyStructureAsPlainText(target);

        expect(StructureService.formatStructure).toHaveBeenCalledWith(
            { app: {} },
            PLAIN_TEXT_OUTPUT_FORMAT,
        );
    });

    it('uses json format via copyStructureAsJson', async () => {
        const target = vscode.Uri.file('/workspace/app');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vi.spyOn(StructureService, 'getStructure').mockResolvedValue({ app: {} });
        vi.spyOn(StructureService, 'formatStructure').mockReturnValue('{}');

        await copyStructureAsJson(target);

        expect(StructureService.formatStructure).toHaveBeenCalledWith(
            { app: {} },
            JSON_OUTPUT_FORMAT,
        );
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('{}');
    });

    it('prompts for a folder when the provided uri is not a directory', async () => {
        const picked = vscode.Uri.file('/workspace/picked');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vscode.window.showOpenDialog.mockResolvedValueOnce([picked]);
        vi.spyOn(StructureService, 'getStructure').mockResolvedValue({ picked: {} });
        vi.spyOn(StructureService, 'formatStructure').mockReturnValue('{}');

        await copyStructure(undefined as unknown as vscode.Uri, PLAIN_TEXT_OUTPUT_FORMAT);

        expect(vscode.window.showOpenDialog).toHaveBeenCalled();
        expect(vscode.env.clipboard.writeText).toHaveBeenCalled();
    });

    it('shows an error when folder selection is cancelled', async () => {
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(false);
        vscode.window.showOpenDialog.mockResolvedValueOnce(undefined);

        await copyStructure(undefined as unknown as vscode.Uri, PLAIN_TEXT_OUTPUT_FORMAT);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Please select a valid folder'),
        );
    });

    it('shows an error when structure generation fails', async () => {
        const target = vscode.Uri.file('/workspace/app');
        vi.spyOn(FileSystemService, 'isDirectory').mockResolvedValue(true);
        vi.spyOn(StructureService, 'getStructure').mockRejectedValue(new Error('boom'));

        await copyStructure(target, PLAIN_TEXT_OUTPUT_FORMAT);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('boom'),
        );
    });
});
