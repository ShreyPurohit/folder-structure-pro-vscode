import * as vscode from 'vscode';

export class FileSystemService {
    private static toUri(inputPath: string | vscode.Uri): vscode.Uri {
        return inputPath instanceof vscode.Uri ? inputPath : vscode.Uri.file(inputPath);
    }

    static async isDirectory(inputPath: string | vscode.Uri): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(this.toUri(inputPath));
            return (stat.type & vscode.FileType.Directory) === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
