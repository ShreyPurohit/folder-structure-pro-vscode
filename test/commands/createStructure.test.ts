import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { createStructure } from '../../src/commands/createStructure';
import { StructureService } from '../../src/services/structure';
import { FileSystemService } from '../../src/services/fileSystem';
import { resetVscodeMocks } from '../__mocks__/vscode';

type MessageHandler = (message: Record<string, unknown>) => Promise<void>;

function createPanelMock() {
    let messageHandler: MessageHandler | undefined;
    const postMessage = vi.fn();
    const dispose = vi.fn();

    const panel = {
        webview: {
            html: '',
            postMessage,
            onDidReceiveMessage: vi.fn((handler: MessageHandler) => {
                messageHandler = handler;
                return { dispose: vi.fn() };
            }),
        },
        dispose,
    };

    vscode.window.createWebviewPanel.mockReturnValue(panel);

    return {
        panel,
        postMessage,
        dispose,
        async send(message: Record<string, unknown>) {
            if (!messageHandler) {
                throw new Error('Message handler not registered');
            }
            await messageHandler(message);
        },
    };
}

describe('createStructure command', () => {
    beforeEach(() => {
        resetVscodeMocks();
        vi.restoreAllMocks();
    });

    it('shows an error when target folder selection is cancelled', async () => {
        vscode.window.showOpenDialog.mockResolvedValueOnce(undefined);
        await createStructure();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Target directory is required'),
        );
    });

    it('validates plain text input from the webview', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();

        await createStructure();
        await panelMock.send({
            command: 'validate',
            format: 'Plain Text Format',
            text: `Directory structure:
└── app/
    └── index.ts`,
        });

        expect(panelMock.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                command: 'validationResult',
                valid: true,
            }),
        );
    });

    it('reports invalid JSON during validation', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();

        await createStructure();
        await panelMock.send({
            command: 'validate',
            format: 'JSON Format',
            text: '{ invalid',
        });

        expect(panelMock.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                command: 'validationResult',
                valid: false,
                errorMessage: expect.stringContaining('Invalid JSON'),
            }),
        );
    });

    it('creates structure on submit and disposes the panel', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        vi.spyOn(FileSystemService, 'exists').mockResolvedValue(false);
        vi.spyOn(StructureService, 'createStructure').mockResolvedValue();

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'JSON Format',
            text: JSON.stringify({ app: { index: 'ts' } }),
        });

        expect(StructureService.createStructure).toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Project created successfully!',
        );
        expect(panelMock.dispose).toHaveBeenCalled();
    });

    it('prompts before replacing existing targets', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        vi.spyOn(FileSystemService, 'exists').mockResolvedValue(true);
        vi.spyOn(FileSystemService, 'delete').mockResolvedValue();
        vi.spyOn(StructureService, 'createStructure').mockResolvedValue();
        vscode.window.showWarningMessage.mockResolvedValueOnce('Replace');

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'JSON Format',
            text: JSON.stringify({ app: { index: 'ts' } }),
        });

        expect(FileSystemService.delete).toHaveBeenCalled();
        expect(StructureService.createStructure).toHaveBeenCalled();
    });

    it('copies preview text to the clipboard', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();

        await createStructure();
        await panelMock.send({
            command: 'copyPreview',
            text: 'preview text',
        });

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('preview text');
    });

    it('aborts submit when user cancels replacement dialog', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        vi.spyOn(FileSystemService, 'exists').mockResolvedValue(true);
        const createSpy = vi.spyOn(StructureService, 'createStructure').mockResolvedValue();
        vscode.window.showWarningMessage.mockResolvedValueOnce('Cancel');

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'JSON Format',
            text: JSON.stringify({ app: { index: 'ts' } }),
        });

        expect(createSpy).not.toHaveBeenCalled();
    });

    it('reports empty plain text validation', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();

        await createStructure();
        await panelMock.send({
            command: 'validate',
            format: 'Plain Text Format',
            text: 'not a tree',
        });

        expect(panelMock.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                command: 'validationResult',
                valid: false,
                errorMessage: 'Empty input or no valid lines.',
            }),
        );
    });

    it('aborts plain text submit when user declines invalid input', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        const createSpy = vi.spyOn(StructureService, 'createStructure').mockResolvedValue();
        vscode.window.showWarningMessage.mockResolvedValueOnce('No');

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'Plain Text Format',
            text: 'not a tree',
        });

        expect(createSpy).not.toHaveBeenCalled();
    });

    it('continues with skip when existing targets are not replaced', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        vi.spyOn(FileSystemService, 'exists').mockResolvedValue(true);
        const deleteSpy = vi.spyOn(FileSystemService, 'delete').mockResolvedValue();
        vi.spyOn(StructureService, 'createStructure').mockResolvedValue();
        vscode.window.showWarningMessage.mockResolvedValueOnce('Skip');

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'JSON Format',
            text: JSON.stringify({ app: { index: 'ts' } }),
        });

        expect(deleteSpy).not.toHaveBeenCalled();
        expect(StructureService.createStructure).toHaveBeenCalled();
    });

    it('shows error for invalid JSON structure on submit', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'JSON Format',
            text: JSON.stringify({ app: [] }),
        });

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Invalid JSON structure'),
        );
    });

    it('shows error when structure creation fails on submit', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        vi.spyOn(FileSystemService, 'exists').mockResolvedValue(false);
        vi.spyOn(StructureService, 'createStructure').mockRejectedValue(new Error('disk full'));

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'JSON Format',
            text: JSON.stringify({ app: { index: 'ts' } }),
        });

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('disk full'),
        );
    });

    it('continues plain text submit after user confirms invalid input', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        vi.spyOn(FileSystemService, 'exists').mockResolvedValue(false);
        vi.spyOn(StructureService, 'createStructure').mockResolvedValue();
        vscode.window.showWarningMessage.mockResolvedValueOnce('Yes');

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'Plain Text Format',
            text: `Directory structure:
├── app/
│   ├── `,
        });

        expect(StructureService.createStructure).toHaveBeenCalled();
    });

    it('shows parse error for malformed JSON on submit', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();

        await createStructure();
        await panelMock.send({
            command: 'submit',
            format: 'JSON Format',
            text: '{ invalid',
        });

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Invalid JSON'),
        );
    });

    it('shows error when preview copy fails', async () => {
        const target = vscode.Uri.file('/workspace/target');
        vscode.window.showOpenDialog.mockResolvedValueOnce([target]);
        const panelMock = createPanelMock();
        vi.mocked(vscode.env.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));

        await createStructure();
        await panelMock.send({
            command: 'copyPreview',
            text: 'preview text',
        });

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to copy preview');
    });
});
