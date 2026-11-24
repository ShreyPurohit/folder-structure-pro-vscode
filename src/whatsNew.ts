import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { CLI_COMMAND, CLI_PACKAGE_URL } from './constants';

/** Set once the CLI announcement has been shown, on any machine (synced). */
export const CLI_ANNOUNCEMENT_KEY = 'whatsNew.cliAnnouncementShown';
/** The version that last ran, so later releases can tell an update from a new install. */
export const LAST_VERSION_KEY = 'whatsNew.lastVersion';

const EXTENSION_ID = 'iamshreydxv.copy-folder-structure';

/**
 * Images shown on the What's New page, if present. Put the files in assets/whats-new/;
 * a missing image is simply left out.
 */
export const WHATS_NEW_IMAGES = [
    {
        file: 'extension-view.png',
        title: 'A clearer Create Folder Structure panel',
        text: 'See where files go, what will be created and which lines to fix, before anything is created.',
        alt: 'The Create Folder Structure panel in VS Code',
    },
    {
        file: 'cli.png',
        title: 'Folder Structure Pro in your terminal',
        text: 'Copy and recreate structures from any folder, even over SSH.',
        alt: 'Folder Structure Pro running in a terminal',
    },
] as const;

export const CLI_ANNOUNCEMENT =
    'New: Folder Structure Pro also works from your terminal. Run "npx folder-structure-pro" to copy or create structures from any folder, even over SSH.';

function currentVersion(): string | undefined {
    const version: unknown = vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON?.version;
    return typeof version === 'string' ? version : undefined;
}

async function copyCommand(): Promise<void> {
    try {
        await vscode.env.clipboard.writeText(CLI_COMMAND);
        vscode.window.showInformationMessage(`Copied "${CLI_COMMAND}". Paste it in any terminal.`);
    } catch {
        vscode.window.showErrorMessage('Failed to copy the command');
    }
}

/**
 * Shows the CLI announcement once, ever. The flag is synced, so Settings Sync users see it
 * on one machine only, and it is saved before the message appears, so windows opening at the
 * same time don't both show it.
 */
export async function announceCliOnce(context: vscode.ExtensionContext): Promise<void> {
    // Register before reading, so a value synced from another machine is respected.
    context.globalState.setKeysForSync([CLI_ANNOUNCEMENT_KEY]);
    const version = currentVersion();
    if (version) {
        await context.globalState.update(LAST_VERSION_KEY, version);
    }
    if (context.globalState.get<boolean>(CLI_ANNOUNCEMENT_KEY)) {
        return;
    }
    await context.globalState.update(CLI_ANNOUNCEMENT_KEY, true);

    const choice = await vscode.window.showInformationMessage(
        CLI_ANNOUNCEMENT,
        "What's New",
        'Copy command',
    );
    if (choice === "What's New") {
        await showWhatsNew(context);
    } else if (choice === 'Copy command') {
        await copyCommand();
    }
}

const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

async function exists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

/** Opens the What's New page. Also available as the "What's New" command. */
export async function showWhatsNew(context: vscode.ExtensionContext): Promise<vscode.WebviewPanel> {
    const imagesFolder = vscode.Uri.joinPath(context.extensionUri, 'assets', 'whats-new');
    const panel = vscode.window.createWebviewPanel(
        'folderStructureWhatsNew',
        "Folder Structure Pro: What's New",
        vscode.ViewColumn.One,
        { enableScripts: true, localResourceRoots: [imagesFolder] },
    );

    const sections: string[] = [];
    for (const image of WHATS_NEW_IMAGES) {
        const file = vscode.Uri.joinPath(imagesFolder, image.file);
        const picture = (await exists(file))
            ? `<img src="${panel.webview.asWebviewUri(file).toString()}" alt="${escapeHtml(image.alt)}">`
            : '';
        sections.push(
            `<section><h2>${escapeHtml(image.title)}</h2><p>${escapeHtml(image.text)}</p>${picture}</section>`,
        );
    }

    const nonce = randomBytes(16).toString('base64');
    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>What's New</title>
<style>
body{max-width:900px;margin:0 auto;padding:24px 20px 40px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);line-height:1.6;color:var(--vscode-foreground)}
h1{font-size:1.6em;margin:0 0 4px}
.lead{margin:0 0 20px;color:var(--vscode-descriptionForeground)}
section{margin:0 0 28px}
h2{font-size:1.15em;margin:0 0 4px}
section p{margin:0 0 10px;color:var(--vscode-descriptionForeground)}
img{display:block;max-width:100%;height:auto;border:1px solid var(--vscode-panel-border, transparent);border-radius:8px}
.command{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0 28px}
code{padding:6px 10px;border-radius:6px;font-family:var(--vscode-editor-font-family);background:var(--vscode-textCodeBlock-background)}
button{padding:6px 14px;border:0;border-radius:4px;cursor:pointer;font:inherit;color:var(--vscode-button-foreground);background:var(--vscode-button-background)}
button:hover{background:var(--vscode-button-hoverBackground)}
button.secondary{color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}
button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
</style>
</head>
<body>
<h1>What's new in Folder Structure Pro</h1>
<p class="lead">Folder Structure Pro now also works from your terminal, with no installation needed:</p>
<div class="command"><code>${escapeHtml(CLI_COMMAND)}</code>
    <button id="copy" type="button">Copy command</button>
    <button id="learnMore" class="secondary" type="button">Learn more</button>
</div>
${sections.join('\n')}
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.getElementById('copy').addEventListener('click', () => vscode.postMessage({ command: 'copyCommand' }));
document.getElementById('learnMore').addEventListener('click', () => vscode.postMessage({ command: 'learnMore' }));
</script>
</body>
</html>`;

    panel.webview.onDidReceiveMessage(async (received: unknown) => {
        const message = (received ?? {}) as { command?: string };
        if (message.command === 'copyCommand') {
            await copyCommand();
        } else if (message.command === 'learnMore') {
            await vscode.env.openExternal(vscode.Uri.parse(CLI_PACKAGE_URL));
        }
    });
    return panel;
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
