import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { copyLinePath } from '../../src/commands/copyLinePath';
import { resetVscodeMocks, mockConfigurationGet } from '../__mocks__/vscode';

describe('copyLinePath command', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('warns when there is no active editor', async () => {
        await copyLinePath();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('No active editor'),
        );
    });

    it('copies a workspace-relative path with line number', async () => {
        const uri = vscode.Uri.file('/workspace/src/app.ts');
        vscode.window.activeTextEditor = {
            document: { uri },
            selection: { active: { line: 4, character: 2 } },
        };
        vscode.workspace.asRelativePath.mockReturnValue('src/app.ts');

        await copyLinePath();

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('src/app.ts:5');
    });

    it('includes column when configured', async () => {
        const uri = vscode.Uri.file('/workspace/src/app.ts');
        vscode.window.activeTextEditor = {
            document: { uri },
            selection: { active: { line: 0, character: 9 } },
        };
        mockConfigurationGet.mockImplementation((key: string, defaultValue?: unknown) => {
            if (key === 'copyLine.includeColumn') {
                return true;
            }
            return defaultValue;
        });
        vscode.workspace.asRelativePath.mockReturnValue('src/app.ts');

        await copyLinePath();

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('src/app.ts:1:10');
    });

    it('uses absolute path for local files when configured', async () => {
        const uri = vscode.Uri.file('C:/workspace/src/app.ts');
        vscode.window.activeTextEditor = {
            document: { uri },
            selection: { active: { line: 1, character: 0 } },
        };
        mockConfigurationGet.mockImplementation((key: string, defaultValue?: unknown) => {
            if (key === 'copyLine.useAbsolutePath') {
                return true;
            }
            return defaultValue;
        });

        await copyLinePath();

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('C:/workspace/src/app.ts:2');
    });

    it('falls back to relative path for non-file schemes when absolute is requested', async () => {
        const uri = new vscode.Uri('untitled', '', '/Untitled-1', '', '');
        vscode.window.activeTextEditor = {
            document: { uri },
            selection: { active: { line: 0, character: 0 } },
        };
        mockConfigurationGet.mockImplementation((key: string, defaultValue?: unknown) => {
            if (key === 'copyLine.useAbsolutePath') {
                return true;
            }
            return defaultValue;
        });
        vscode.workspace.asRelativePath.mockReturnValue('Untitled-1');

        await copyLinePath();

        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('Untitled-1:1');
    });
});
