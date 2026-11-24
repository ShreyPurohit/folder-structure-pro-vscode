import * as vscode from 'vscode';
import { CLI_COMMAND } from '../constants';
import { getScripts, getStyles, icon } from './helpers';

export interface DestinationLabel {
    /** Full path, shown in the header. */
    path: string;
    /** Folder name, used in the summary sentence. */
    name: string;
}

const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

const getWebviewContent = (formatChoice: string, destination: DestinationLabel): string => {
    const path = escapeHtml(destination.path);
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"><title>Create Folder Structure</title><style>${getStyles()}</style></head><body><main class="container"><header><div><h1 class="title">Create Folder Structure</h1><p class="subtitle">Paste a tree or JSON. Nothing is created until you confirm.</p></div><div class="header-actions"><span class="destination">${icon('folder')}<span class="destination-label">Destination:</span><span id="destinationPath" class="destination-path mono" title="${path}" data-name="${escapeHtml(destination.name)}"><bdi id="destinationPathText">${path}</bdi></span></span><button id="changeDestinationBtn" class="btn btn-on-header btn-sm" type="button">Change…</button><button id="themeBtn" class="btn btn-on-header btn-icon" type="button" aria-label="Switch theme" title="Switch theme"><span id="themeIconLight">${icon('sun')}</span><span id="themeIconDark" style="display:none">${icon('moon')}</span></button></div></header><div class="toolbar"><div class="segmented" role="radiogroup" aria-label="Structure format"><button type="button" role="radio" data-format="Plain Text Format" aria-checked="${formatChoice === 'Plain Text Format'}">Plain text</button><button type="button" role="radio" data-format="JSON Format" aria-checked="${formatChoice === 'JSON Format'}">JSON</button></div><button id="exampleBtn" class="btn btn-sm" type="button">${icon('plus')}Insert example</button><button id="clearBtn" class="btn btn-ghost btn-sm" type="button">Clear</button><span class="tip">Tip: right-click a folder and choose <b>Copy Folder Structure As</b>, then paste it here.</span></div><div class="content"><section class="pane"><label class="pane-label" for="folderStructure">Your structure</label><div class="editor"><div id="lineNumbers" class="line-numbers" aria-hidden="true">1</div><textarea id="folderStructure" spellcheck="false" autocomplete="off" wrap="off" aria-describedby="summaryText"></textarea></div></section><section class="pane" aria-live="polite"><div class="pane-label">What will be created <span id="status" class="badge">Empty</span></div><pre id="preview" class="code-box output placeholder" aria-label="Preview"></pre><ul id="problems" class="code-box problems" aria-label="Lines to fix" hidden></ul></section></div><footer><div id="summary" class="summary"><span class="dot" aria-hidden="true"></span><span id="summaryText"></span></div><div class="actions"><button id="copyBtn" class="btn btn-ghost" type="button" disabled>${icon('copy')}<span class="label">Copy preview</span></button><button id="submitBtn" class="btn btn-primary" type="button" disabled><span id="submitLabel">Create</span></button></div></footer><aside class="cli-strip" aria-label="Command-line tool">${icon('terminal')}<span class="cli-text"><b>Also in your terminal.</b> Copy and recreate structures from any folder, even over SSH.</span><span class="cli-actions"><span class="cli-command"><code><span class="prompt">$</span>${escapeHtml(CLI_COMMAND)}</code><button id="copyCommandBtn" class="btn btn-sm" type="button" aria-label="Copy the command">${icon('copy')}<span class="label">Copy</span></button></span><button id="learnMoreBtn" class="btn btn-ghost btn-sm" type="button">${icon('external')}Learn more</button></span></aside></main>${getScripts(formatChoice)}</body></html>`;
};

export const createStructureInputPanel = (
    formatChoice: string,
    destination: DestinationLabel,
): vscode.WebviewPanel => {
    const panel = vscode.window.createWebviewPanel(
        'folderStructureInput',
        'Create Folder Structure',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true },
    );

    panel.webview.html = getWebviewContent(formatChoice, destination);
    return panel;
};

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
