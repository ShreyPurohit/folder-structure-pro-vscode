import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import ignore from 'ignore';
import { loadIgnoreRules, getFolderStructure, formatStructure } from './utils';

export default vscode.commands.registerCommand('extension.copyFolderStructure', async (uri: vscode.Uri) => {
    try {
        if (!uri || !fs.statSync(uri.fsPath).isDirectory()) {
            vscode.window.showErrorMessage('Please select a valid folder.');
            return;
        }

        const rootPath = uri.fsPath;
        const gitignorePath = path.join(rootPath, '.gitignore');
        const ignoreRules = loadIgnoreRules(gitignorePath);
        const ig = ignore().add(ignoreRules);

        const structure = getFolderStructure(rootPath, ig);
        const outputFormat = vscode.workspace.getConfiguration('folderStructure').get<string>('outputFormat', 'JSON Format');
        const formattedStructure = formatStructure(structure, outputFormat);

        await vscode.env.clipboard.writeText(formattedStructure);
        vscode.window.showInformationMessage('Folder structure copied to clipboard!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy folder structure: ${(error as Error).message}`);
    }
});

/*
 * Copyright (c) 2024 Shrey Purohit.
 * This code is licensed under the MIT License.
 */