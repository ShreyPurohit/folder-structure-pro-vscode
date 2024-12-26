import * as path from 'path';
import * as vscode from 'vscode';
import { ensureDirectoryExists, ensureFileExists } from './utils';

/**
 * Creates a folder structure from a plain text representation.
 * @param basePath The base directory path where the structure will be created.
 * @param plainText The plain text representation of the folder structure.
 */
function createFolderStructureForPlainTextFormat(basePath: string, plainText: string): void {
    const lines = plainText.split('\n').filter(line => line.trim());
    const stack: string[] = [];

    lines.forEach((line) => {
        const level = Math.floor(line.search(/\S/) / 4); // Indentation level
        if (level < 0) {
            throw new Error(`Invalid indentation level for line: ${line}`);
        }

        const isDirectory = line.trim().endsWith('/');
        const name = line.trim().replace('|-- ', '').replace(/\/$/, '');

        // Adjust stack to match the current indentation level
        while (stack.length > level) {
            stack.pop();
        }

        const fullPath = path.join(basePath, ...stack, name);

        if (isDirectory) {
            ensureDirectoryExists(fullPath);
            stack.push(name);
        } else {
            ensureFileExists(fullPath);
        }
    });
}

/**
 * Recursively creates a folder structure from JSON format.
 * @param basePath The base directory path where the structure will be created.
 * @param structure JSON structure representing the folders and files.
 */
function createFolderStructureForJSONFormat(basePath: string, structure: Record<string, any>): void {
    Object.entries(structure).forEach(([key, value]) => {
        const fullPath = path.join(basePath, key);
        if (typeof value === 'object' && value !== null) {
            ensureDirectoryExists(fullPath);
            createFolderStructureForJSONFormat(fullPath, value);
        } else {
            ensureFileExists(fullPath);
        }
    });
}

/**
 * Handles the project creation logic based on the user's input.
 */
async function handleProjectCreation() {
    try {
        const targetDir = await vscode.window.showInputBox({
            placeHolder: 'Enter the target directory path to create the project',
        });

        if (!targetDir) {
            vscode.window.showErrorMessage('Target directory is required.');
            return;
        }

        const resolvedPath = path.isAbsolute(targetDir)
            ? targetDir
            : path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd(), targetDir);

        const formatChoice = await vscode.window.showQuickPick(['Plain Text', 'JSON'], {
            placeHolder: 'Choose the format of the folder structure',
        });

        if (!formatChoice) {
            vscode.window.showInformationMessage('Operation canceled.');
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'folderStructureInput',
            'Folder Structure Input',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent(formatChoice);

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'submit') {
                const structureContent = message.text;
                try {
                    if (formatChoice === 'Plain Text') {
                        if (!structureContent.trim()) {
                            throw new Error('Plain Text structure cannot be empty.');
                        }
                        createFolderStructureForPlainTextFormat(resolvedPath, structureContent);
                    } else if (formatChoice === 'JSON') {
                        const jsonStructure = JSON.parse(structureContent);
                        createFolderStructureForJSONFormat(resolvedPath, jsonStructure);
                    }
                    vscode.window.showInformationMessage('Project created successfully!');
                    panel.dispose();
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error processing folder structure: ${error.message}`);
                }
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to create project: ${error.message}`);
    }
}

/**
 * Returns the HTML content for the webview based on the selected format.
 * @param formatChoice The format chosen by the user (Plain Text or JSON).
 * @returns The HTML content for the webview.
 */
function getWebviewContent(formatChoice: string): string {
    return `
    <!DOCTYPE html>
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
    </html>
    `;
}

export default vscode.commands.registerCommand(
    'extension.createProjectFromStructure',
    handleProjectCreation
);

/*
 * Copyright (c) 2024 Shrey Purohit.
 * This code is licensed under the MIT License.
 */