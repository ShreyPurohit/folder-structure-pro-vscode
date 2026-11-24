import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { createStructureInputPanel } from '../../src/ui/webview';
import { resetVscodeMocks } from '../__mocks__/vscode';

const DESTINATION = { path: '/workspace/shop', name: 'shop' };

function render(format: string, destination = DESTINATION): string {
    resetVscodeMocks();
    const panel = { webview: { html: '' } };
    vscode.window.createWebviewPanel.mockReturnValue(panel);
    createStructureInputPanel(format, destination);
    return panel.webview.html;
}

describe('createStructureInputPanel', () => {
    it('opens a panel titled after the command', () => {
        render('Plain Text Format');
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
            'folderStructureInput',
            'Create Folder Structure',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true },
        );
    });

    it('shows the destination, the format choice and the CLI strip', () => {
        const html = render('Plain Text Format');
        expect(html).toContain('<h1 class="title">Create Folder Structure</h1>');
        expect(html).toContain('/workspace/shop');
        expect(html).toContain('data-name="shop"');
        expect(html).toContain('data-format="Plain Text Format" aria-checked="true"');
        expect(html).toContain('data-format="JSON Format" aria-checked="false"');
        expect(html).toContain('npx folder-structure-pro');
        expect(html).toContain('id="copyCommandBtn"');
        expect(html).toContain('id="learnMoreBtn"');
        expect(html).toContain('id="themeBtn"');
        expect(html).toContain('id="changeDestinationBtn"');
    });

    it('starts with the Create button disabled', () => {
        expect(render('Plain Text Format')).toMatch(/id="submitBtn"[^>]*disabled/);
    });

    it('selects JSON when requested and embeds its example', () => {
        const html = render('JSON Format');
        expect(html).toContain('data-format="JSON Format" aria-checked="true"');
        expect(html).toContain('\\"index\\": \\"js\\"');
    });

    it('escapes a destination path that looks like markup', () => {
        const html = render('Plain Text Format', { path: '/tmp/<b>"x"</b>', name: '<b>' });
        expect(html).not.toContain('<b>"x"</b>');
        expect(html).toContain('&#60;b&#62;&#34;x&#34;&#60;/b&#62;');
    });
});
