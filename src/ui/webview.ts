import * as vscode from 'vscode';
import { getExample, getScripts, getStyles } from './helpers';

const getWebviewContent = (formatChoice: string): string => {
    const styles = getStyles();
    const scripts = getScripts(formatChoice);
    const example = getExample(formatChoice);

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><title>Folder Structure</title><style>${styles}</style></head><body><div class="container"><header><div class="header-title"><h1 class="title">Folder Structure Builder</h1><button id="themeBtn" class="icon-btn theme-toggle" title="Toggle theme" aria-label="Toggle theme"><span id="themeIcon" aria-hidden="true">☾</span></button></div><div class="button-group"><div id="status" class="btn status-badge"><div class="status-indicator"></div><span>Ready</span></div><select id="formatSelect" title="Output format" aria-label="Output format"><option value="Plain Text Format" ${formatChoice === 'Plain Text Format' ? 'selected' : ''}>Plain Text</option><option value="JSON Format" ${formatChoice === 'JSON Format' ? 'selected' : ''}>JSON</option></select><button class="btn interactive-btn"><span>View Example</span><div class="example-content">${example}</div></button></div></header><div class="content"><div class="input-section"><div class="section-label">Input (${formatChoice})</div><textarea id="folderStructure" placeholder="Paste your folder structure here and watch the magic happen..." aria-label="Folder structure input"></textarea></div><div class="preview-section"><div class="section-label">Preview</div><pre id="preview" class="preview" aria-label="Structure preview"></pre></div></div><footer><div class="button-group"><button class="btn btn-secondary" id="copyBtn" title="Copy preview to clipboard">Copy Preview</button><button class="btn btn-secondary" id="clearBtn" title="Clear input field">Clear All</button></div><button class="btn btn-primary" id="submitBtn">Create Structure</button></footer></div>${scripts}</body></html>`;
};

export const createStructureInputPanel = (formatChoice: string): vscode.WebviewPanel => {
    const panel = vscode.window.createWebviewPanel(
        'folderStructureInput',
        'Folder Structure Input',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true },
    );

    panel.webview.html = getWebviewContent(formatChoice);
    return panel;
};

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
