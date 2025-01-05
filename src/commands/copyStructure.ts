import * as vscode from 'vscode';
import { ERROR_MESSAGES } from '../constants';
import { FileSystemService } from '../services/fileSystem';
import { StructureService } from '../services/structure';
import { OutputFormat } from '../types';

export async function copyStructure(uri: vscode.Uri): Promise<void> {
    try {
        if (!uri || !(await FileSystemService.isDirectory(uri.fsPath))) {
            throw new Error(ERROR_MESSAGES.INVALID_DIRECTORY);
        }

        const structure = await StructureService.getStructure(uri.fsPath);
        const outputFormat = vscode.workspace.getConfiguration('folderStructure')
            .get<string>('outputFormat', 'JSON Format') as OutputFormat;
        const formattedStructure = StructureService.formatStructure(structure, outputFormat);

        await vscode.env.clipboard.writeText(formattedStructure);
        vscode.window.showInformationMessage('Folder structure copied to clipboard!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy folder structure: ${(error as Error).message}`);
    }
}