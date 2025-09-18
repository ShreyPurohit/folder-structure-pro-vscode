import * as vscode from 'vscode';
import { ERROR_MESSAGES, DEFAULT_OUTPUT_FORMAT } from '../constants';
import { FileSystemService } from '../services/fileSystem';
import { StructureService } from '../services/structure';
import { OutputFormat } from '../types';

export async function copyStructure(uri: vscode.Uri): Promise<void> {
    try {
        let target = uri;
        if (!target || !(await FileSystemService.isDirectory(target))) {
            const pick = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
            });
            if (!pick || !(await FileSystemService.isDirectory(pick[0]))) {
                throw new Error(ERROR_MESSAGES.INVALID_DIRECTORY);
            }
            target = pick[0];
        }

        const structure = await StructureService.getStructure(target.fsPath);
        const outputFormat = vscode.workspace
            .getConfiguration('folderStructure')
            .get<OutputFormat>('outputFormat', DEFAULT_OUTPUT_FORMAT);
        const formattedStructure = StructureService.formatStructure(structure, outputFormat);

        await vscode.env.clipboard.writeText(formattedStructure);
        vscode.window.showInformationMessage('Folder structure copied to clipboard!');
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to copy folder structure: ${(error as Error).message}`,
        );
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
