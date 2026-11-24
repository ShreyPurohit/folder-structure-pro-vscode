import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { CLI_COMMAND, CLI_PACKAGE_URL } from './constants';

/** Set once the CLI announcement has been shown, on any machine (synced). */
export const CLI_ANNOUNCEMENT_KEY = 'whatsNew.cliAnnouncementShown';
/** The version that last ran, so later releases can tell an update from a new install. */
export const LAST_VERSION_KEY = 'whatsNew.lastVersion';

const EXTENSION_ID = 'iamshreydxv.copy-folder-structure';

/**
 * Images shown on the What's New page, if present. Put the files in assets/;
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
    panel.webview.html = `
<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} https://raw.githubusercontent.com; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"><title>What's New</title><style>body{max-width:900px;margin:0 auto;padding:24px 20px 40px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);line-height:1.6;color:var(--vscode-foreground)}h1{font-size:1.6em;margin:0 0 8px}.lead{margin:0 0 24px;color:var(--vscode-descriptionForeground)}section{margin:0 0 28px}h2{font-size:1.15em;margin:0 0 8px}h3{font-size:1em;margin:18px 0 6px}section p{margin:0 0 10px;color:var(--vscode-descriptionForeground)}ul{padding-left:22px;margin:8px 0 14px}li{margin-bottom:6px}img{display:block;max-width:100%;height:auto;margin:16px 0;border:1px solid var(--vscode-panel-border,transparent);border-radius:8px}.command{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0 4px}code{padding:6px 10px;border-radius:6px;font-family:var(--vscode-editor-font-family);background:var(--vscode-textCodeBlock-background)}button{padding:6px 14px;border:0;border-radius:4px;cursor:pointer;font:inherit;color:var(--vscode-button-foreground);background:var(--vscode-button-background)}button:hover{background:var(--vscode-button-hoverBackground)}button.secondary{color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}.divider{border:0;border-top:1px solid var(--vscode-panel-border);margin:24px 0}.highlight{padding:14px 16px;border-left:3px solid var(--vscode-textLink-foreground);background:var(--vscode-textCodeBlock-background);border-radius:4px;margin:14px 0}footer{margin-top:32px;padding-top:16px;border-top:1px solid var(--vscode-panel-border);color:var(--vscode-descriptionForeground);font-size:.9em}footer p{margin:0}a{color:var(--vscode-textLink-foreground)}</style></head><body><h1>What's new in Folder Structure Pro</h1><p class="lead">A major step forward! Folder Structure Pro is no longer limited to the VS Code Explorer. This update introduces a standalone CLI, a redesigned structure builder, and a stronger foundation for safer, more reliable filesystem operations.</p><section><h2>🚀 Meet Folder Structure Pro CLI</h2><p>Take your folder-structure workflow beyond VS Code. The new standalone CLI lets you inspect, copy, export, and create project structures directly from your terminal.</p><div class="highlight"><strong>Try it instantly — no global installation required:</strong><div class="command"><code>${escapeHtml(CLI_COMMAND)}</code><button id="copy" type="button">Copy command</button><button id="learnMore" type="button" class="secondary">Explore CLI</button></div></div><h3>What you can do</h3><ul><li><strong>Copy structures:</strong> Generate folder trees and copy them directly to your clipboard.</li><li><strong>Choose your format:</strong> Export structures as readable Plain Text or structured JSON.</li><li><strong>Recreate projects:</strong> Build directories and files from an existing folder structure.</li><li><strong>Customize traversal:</strong> Control depth, hidden files, and exclusion patterns.</li><li><strong>Respect .gitignore:</strong> Exclude files and directories using Git ignore rules.</li><li><strong>Work remotely:</strong> Use OSC 52 clipboard support to copy structures over compatible SSH terminals.</li><li><strong>Run on demand:</strong> Use npx without installing the CLI globally.</li></ul><img src="https://raw.githubusercontent.com/ShreyPurohit/folder-structure-pro-vscode/main/assets/folder-structure-pro-cli.png" alt="Folder Structure Pro CLI showing folder structure generation and terminal commands" loading="lazy"><p>The CLI is powered by the same shared core as the VS Code extension and is distributed without production dependencies.</p></section><hr class="divider"><section><h2>🎨 A Redesigned Structure Creation Experience</h2><p>Creating a project structure is now more visual and intuitive. The redesigned builder gives you better control over your input, destination, preview, and final creation.</p><h3>What's improved</h3><ul><li><strong>Plain Text and JSON:</strong> Work with either supported input format.</li><li><strong>Live preview:</strong> See the structure before creating files or directories.</li><li><strong>Instant validation:</strong> Identify invalid input and resolve issues before proceeding.</li><li><strong>Example structures:</strong> Load a sample to understand the expected format.</li><li><strong>Destination selection:</strong> Choose or change the location where your structure will be created.</li><li><strong>Light and dark themes:</strong> Switch the builder's appearance to suit your preference.</li><li><strong>Quick editing:</strong> Clear input and copy the generated preview with dedicated actions.</li><li><strong>Creation summary:</strong> Review the number of folders and files before proceeding.</li><li><strong>Explicit confirmation:</strong> Review your choices before starting the creation process.</li></ul><img src="https://raw.githubusercontent.com/ShreyPurohit/folder-structure-pro-vscode/main/assets/folder_structure_pro.png" alt="Redesigned Folder Structure Pro builder showing the structure creation interface" loading="lazy"></section><hr class="divider"><section><h2>🔐 Safer Creation &amp; Filesystem Reliability</h2><p>Creating files and directories should never put existing project data at unnecessary risk. This update strengthens how the extension and CLI validate paths, handle conflicts, and recover from failures.</p><ul><li><strong>Path traversal protection:</strong> Validate paths to prevent operations from escaping the selected destination.</li><li><strong>Symlink-aware handling:</strong> Improve handling of symbolic links to avoid unintended filesystem traversal.</li><li><strong>Conflict detection:</strong> Identify existing files and directories before making changes.</li><li><strong>Controlled replacement:</strong> Make replacement behavior explicit rather than silently overwriting existing content.</li><li><strong>Safer file creation:</strong> Use exclusive creation and atomic operations where supported to reduce the risk of partial or unintended changes.</li><li><strong>Failure recovery:</strong> Improve cleanup and restoration when filesystem operations fail, including reporting cases that require manual recovery.</li><li><strong>Expanded test coverage:</strong> Add regression tests for path validation, conflicts, cleanup, and failure scenarios.</li></ul><p>These changes help preserve existing data and make filesystem operations more predictable across supported environments.</p></section><hr class="divider"><section><h2>⚙️ One Shared Core, Two Ways to Work</h2><p>The VS Code extension and standalone CLI now share the same core functionality instead of maintaining separate implementations.</p><ul><li><strong>Shared creation engine:</strong> Consistent structure creation logic across both interfaces.</li><li><strong>Filesystem adapters:</strong> Platform-specific filesystem operations are separated from the shared logic.</li><li><strong>Consistent validation:</strong> Reuse path validation, conflict planning, and creation rules.</li><li><strong>Better maintainability:</strong> Improvements to shared functionality can benefit both the extension and CLI.</li><li><strong>Environment flexibility:</strong> Support native filesystem paths in the CLI and URI-based filesystem operations in VS Code environments.</li></ul></section><hr class="divider"><section><h2>✨ More Improvements</h2><ul><li>More consistent Plain Text and JSON parsing.</li><li>Improved handling of root-level files and multiple workspace roots.</li><li>Better folder-tree formatting and output consistency.</li><li>Clearer validation messages and filesystem error reporting.</li><li>Improved handling of temporary files, backups, and cleanup operations.</li></ul></section><footer><p>Thank you for being part of Folder Structure Pro! If you find it useful, consider leaving a ⭐ on <a href="https://github.com/ShreyPurohit/folder-structure-pro-vscode">GitHub</a>.</p></footer><script nonce="${nonce}">const vscode=acquireVsCodeApi();document.getElementById('copy').addEventListener('click',()=>{vscode.postMessage({command:'copyCommand'});});document.getElementById('learnMore').addEventListener('click',()=>{vscode.postMessage({command:'learnMore'});});</script></body></html>
`;

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
