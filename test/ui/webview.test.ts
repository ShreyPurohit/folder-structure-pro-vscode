import { describe, expect, it } from 'vitest';
import { createStructureInputPanel } from '../../src/ui/webview';
import { resetVscodeMocks } from '../__mocks__/vscode';
import * as vscode from 'vscode';

describe('createStructureInputPanel', () => {
    it('creates a webview panel with html content for plain text format', () => {
        resetVscodeMocks();
        const panel = {
            webview: { html: '' },
        };
        vscode.window.createWebviewPanel.mockReturnValue(panel);

        const result = createStructureInputPanel('Plain Text Format');

        expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
            'folderStructureInput',
            'Folder Structure Input',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true },
        );
        expect(result.webview.html).toContain('Folder Structure Builder');
        expect(result.webview.html).toContain('Plain Text Format');
    });

    it('embeds JSON format selection when requested', () => {
        resetVscodeMocks();
        const panel = {
            webview: { html: '' },
        };
        vscode.window.createWebviewPanel.mockReturnValue(panel);

        createStructureInputPanel('JSON Format');

        expect(panel.webview.html).toContain('JSON Format');
        expect(panel.webview.html).toContain('"index": "js"');
    });
});
