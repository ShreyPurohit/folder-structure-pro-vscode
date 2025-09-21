import * as path from 'path';
import * as vscode from 'vscode';
import { ERROR_MESSAGES } from '../constants';
import { FileSystemService } from '../services/fileSystem';

export async function copyFileName(uri: vscode.Uri): Promise<void> {
    try {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!target?.fsPath) {
            throw new Error(ERROR_MESSAGES.INVALID_FILE);
        }

        if (target.scheme !== 'file') {
            throw new Error('This operation is only supported for local files.');
        }

        const isDirectory = await FileSystemService.isDirectory(target);
        if (isDirectory) {
            throw new Error(ERROR_MESSAGES.INVALID_FILE);
        }

        const fileName = path.basename(target.fsPath);
        await vscode.env.clipboard.writeText(fileName);
        vscode.window.showInformationMessage(`File name "${fileName}" copied to clipboard!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy file name: ${(error as Error).message}`);
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
