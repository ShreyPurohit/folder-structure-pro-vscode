import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Copies the name of a selected file to the clipboard.
 * @param uri The URI of the selected file. This should represent a valid, local file path.
 * @throws Displays error messages if the file is invalid, inaccessible, or if the operation fails.
 */
export default vscode.commands.registerCommand('extension.copyFileName', async (uri: vscode.Uri) => {
    try {
        if (!uri || !uri.fsPath) {
            vscode.window.showErrorMessage('Invalid file selected. Please try again.');
            return;
        }

        const stat = await fs.promises.stat(uri.fsPath);
        if (stat.isDirectory()) {
            vscode.window.showErrorMessage('Please select a valid file.');
            return;
        }

        try {
            fs.statSync(uri.fsPath);
        } catch (error) {
            vscode.window.showErrorMessage('Permission denied or file inaccessible.');
            return;
        }

        const fileName = path.basename(uri.fsPath);
        if (!fileName) {
            vscode.window.showErrorMessage('Failed to determine the file name.');
            return;
        }

        if (uri.scheme !== 'file') {
            vscode.window.showErrorMessage('This operation is only supported for local files.');
            return;
        }

        await vscode.env.clipboard.writeText(fileName);
        vscode.window.showInformationMessage(`File name "${fileName}" copied to clipboard!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy file name: ${(error as Error).message}`);
    }
});

/*
 * Copyright (c) 2024 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
