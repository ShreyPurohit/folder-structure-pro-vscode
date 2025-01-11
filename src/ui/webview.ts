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
      "index.js": null,
      "styles.css": null
    },
    "README.md": null
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
                    display: flex;
                    justify-content: space-between;
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
                    padding: 20px;
                }

                textarea {
                    width: calc(100% - 24px);
                    height: 300px;
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

                footer {
                    padding: 16px;
                    text-align: right;
                    background: var(--footer-bg);
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
                    <button class="example-btn">
                        View Example
                        <div class="example-content">${example}</div>
                    </button>
                </header>
                <div class="content">
                    <textarea 
                        id="folderStructure" 
                        placeholder="Paste your folder structure here..."
                    ></textarea>
                </div>
                <footer>
                    <button class="submit-btn" onclick="submit()">Submit</button>
                </footer>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                function submit() {
                    const content = document.getElementById('folderStructure').value;
                    vscode.postMessage({ command: 'submit', text: content });
                }
            </script>
        </body>
        </html>`;
    }
}