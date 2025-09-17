import * as vscode from 'vscode';

export class WebviewManager {
    static createStructureInputPanel(formatChoice: string): vscode.WebviewPanel {
        const panel = vscode.window.createWebviewPanel(
            'folderStructureInput',
            'Folder Structure Input',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getWebviewContent(formatChoice);
        return panel;
    }

    private static getWebviewContent(formatChoice: string): string {
        const example = formatChoice === 'Plain Text Format'
            ? `Directory structure:
└── project/
    ├── src/
    │   ├── index.js
    │   └── styles.css
    └── README.md`
            : `{
  "project": {
    "src": {
      "index": "js",
      "styles": "css"
    },
    "README": "md"
  }
}`;

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <title>Folder Structure</title>
            <style>
                :root {
                    --container-bg: var(--vscode-editor-background);
                    --container-fg: var(--vscode-editor-foreground);
                    --header-bg: var(--vscode-titleBar-activeBackground);
                    --header-fg: var(--vscode-titleBar-activeForeground);
                    --button-bg: var(--vscode-button-background);
                    --button-fg: var(--vscode-button-foreground);
                    --button-hover-bg: var(--vscode-button-hoverBackground);
                    --textarea-bg: var(--vscode-input-background);
                    --textarea-fg: var(--vscode-input-foreground);
                    --footer-bg: var(--vscode-statusBar-background);
                    --footer-fg: var(--vscode-statusBar-foreground);
                    --example-popup-bg: var(--vscode-dropdown-background);
                    --example-popup-fg: var(--vscode-dropdown-foreground);
                }
                
                .badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 999px;
                    font-size: 11px;
                    border: 1px solid var(--vscode-panel-border);
                }

                body {
                    font-family: var(--vscode-font-family);
                    margin: 0;
                    padding: 20px;
                    background-color: var(--container-bg);
                    color: var(--container-fg);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-height: 100vh;
                }

                .container {
                    width: 90%;
                    max-width: 800px;
                    background: var(--container-bg);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }

                header {
                    background: var(--header-bg);
                    color: var(--header-fg);
                    padding: 1rem;
                    display: grid;
                    grid-template-columns: 1fr auto auto;
                    gap: 12px;
                    align-items: center;
                }

                .title {
                    font-size: 1.2rem;
                    font-weight: 600;
                }

                .example-btn {
                    background: var(--button-bg);
                    color: var(--button-fg);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 3px;
                    font-size: 12px;
                    position: relative;
                    transition: background-color 0.2s;
                }

                .example-btn:hover {
                    background: var(--button-hover-bg);
                }

                .example-content {
                    display: none;
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: var(--example-popup-bg);
                    color: var(--example-popup-fg);
                    padding: 1rem;
                    border-radius: 4px;
                    border: 1px solid var(--vscode-panel-border);
                    white-space: pre;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 13px;
                    z-index: 1000;
                    text-align: left;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }

                .example-btn:hover .example-content {
                    display: block;
                }

                .content {
                    padding: 16px 20px 20px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                textarea {
                    width: calc(100% - 24px);
                    height: 340px;
                    margin: 0;
                    padding: 12px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background: var(--textarea-bg);
                    color: var(--textarea-fg);
                    font-family: var(--vscode-editor-font-family);
                    font-size: 14px;
                    line-height: 1.5;
                    resize: vertical;
                }

                textarea:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }

                .preview {
                    width: calc(100% - 24px);
                    height: 340px;
                    margin: 0;
                    padding: 12px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 13px;
                    white-space: pre;
                    overflow: auto;
                    background: var(--container-bg);
                    color: var(--container-fg);
                }

                footer {
                    padding: 16px;
                    text-align: right;
                    background: var(--footer-bg);
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                }

                .submit-btn {
                    background: var(--button-bg);
                    color: var(--button-fg);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: background-color 0.2s;
                }

                .submit-btn:hover {
                    background: var(--button-hover-bg);
                }

                .submit-btn:focus {
                    outline: 2px solid var(--vscode-focusBorder);
                    outline-offset: 2px;
                }

                @media (max-width: 600px) {
                    .container {
                        width: 100%;
                    }
                    
                    header {
                        flex-direction: column;
                        gap: 10px;
                        text-align: center;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <span class="title">Paste Folder Structure (${formatChoice})</span>
                    <span id="status" class="badge">Ready</span>
                    <button class="example-btn">
                        View Example
                        <div class="example-content">${example}</div>
                    </button>
                </header>
                <div class="content">
                    <div>
                        <textarea 
                            id="folderStructure" 
                            placeholder="Paste your folder structure here..."
                            aria-label="Folder structure input"
                        ></textarea>
                    </div>
                    <pre id="preview" class="preview" aria-label="Preview"></pre>
                </div>
                <footer>
                    <button class="submit-btn" id="copyBtn" title="Copy preview">Copy Preview</button>
                    <button class="submit-btn" id="clearBtn" title="Clear input">Clear</button>
                    <span style="flex:1"></span>
                    <button class="submit-btn" id="submitBtn">Create</button>
                </footer>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const textarea = document.getElementById('folderStructure');
                const statusEl = document.getElementById('status');
                const previewEl = document.getElementById('preview');
                const submitBtn = document.getElementById('submitBtn');
                const copyBtn = document.getElementById('copyBtn');
                const clearBtn = document.getElementById('clearBtn');

                function renderStatus({ valid, invalidLines, errorMessage }) {
                    if (errorMessage) {
                        statusEl.textContent = 'Invalid';
                        statusEl.style.color = 'var(--vscode-errorForeground)';
                        statusEl.style.borderColor = 'var(--vscode-errorForeground)';
                        return;
                    }
                    if (valid) {
                        statusEl.textContent = 'Valid';
                        statusEl.style.color = 'var(--vscode-editor-foreground)';
                        statusEl.style.borderColor = 'var(--vscode-panel-border)';
                    } else {
                        statusEl.textContent = invalidLines.length ? ('Invalid: ' + invalidLines.join(', ')) : 'Invalid';
                        statusEl.style.color = 'var(--vscode-errorForeground)';
                        statusEl.style.borderColor = 'var(--vscode-errorForeground)';
                    }
                }

                function requestValidation() {
                    const content = textarea.value;
                    vscode.postMessage({ command: 'validate', text: content });
                }

                textarea.addEventListener('input', debounce(requestValidation, 250));
                submitBtn.addEventListener('click', () => {
                    const content = textarea.value;
                    vscode.postMessage({ command: 'submit', text: content });
                });

                copyBtn.addEventListener('click', async () => {
                    const text = previewEl.textContent || '';
                    if (!text) { return; }
                    vscode.postMessage({ command: 'copyPreview', text });
                });

                clearBtn.addEventListener('click', () => {
                    textarea.value = '';
                    requestValidation();
                    textarea.focus();
                });

                window.addEventListener('message', (event) => {
                    const msg = event.data || {};
                    if (msg.command === 'validationResult') {
                        renderStatus(msg);
                        previewEl.textContent = msg.preview || '';
                    }
                });

                function debounce(fn, wait) {
                    let t;
                    return function() {
                        clearTimeout(t);
                        t = setTimeout(fn, wait);
                    };
                }

                // initial validate to show empty/initial state
                requestValidation();
            </script>
        </body>
        </html>`;
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
