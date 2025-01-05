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
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Folder Structure</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #2d2a45;
                    color: #e0e0f0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                }
                .container {
                    width: 80%;
                    max-width: 800px;
                    background: #3c375e;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                    border-radius: 8px;
                    overflow: hidden;
                }
                header {
                    background: #5a4ca8;
                    color: #f3f1ff;
                    padding: 1rem;
                    text-align: center;
                    font-size: 1.5rem;
                    font-weight: bold;
                }
                textarea {
                    width: 100%;
                    height: 300px;
                    border: none;
                    padding: 1rem;
                    font-family: 'Courier New', monospace;
                    background: #1e1a33;
                    color: #e0e0f0;
                }
                textarea:focus {
                    outline: none;
                }
                footer {
                    padding: 1rem;
                    text-align: center;
                    background: #4a426e;
                }
                button {
                    background: #7a68db;
                    color: #f3f1ff;
                    border: none;
                    padding: 0.5rem 1rem;
                    font-weight: bold;
                    border-radius: 4px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>Paste Folder Structure (${formatChoice})</header>
                <textarea id="folderStructure" placeholder="Paste your folder structure here..."></textarea>
                <footer>
                    <button onclick="submit()">Submit</button>
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