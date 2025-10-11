import * as vscode from 'vscode';

export async function copyLinePath(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage(
            'No active editor. Open a file to copy its path and line.',
        );
        return;
    }

    const uri = editor.document.uri;

    // Read user preferences
    const config = vscode.workspace.getConfiguration('folderStructure');
    const includeColumn = config.get<boolean>('copyLine.includeColumn', false);
    const useAbsolutePath = config.get<boolean>('copyLine.useAbsolutePath', false);

    // Build path string based on preference
    let pathStr: string;
    if (useAbsolutePath) {
        if (uri.scheme !== 'file') {
            vscode.window.showWarningMessage(
                'Absolute path is only available for files on disk. Falling back to relative path.',
            );
            // Fallback to relative
            pathStr = vscode.workspace.asRelativePath(uri, false);
        } else {
            pathStr = editor.document.uri.fsPath;
        }
    } else {
        pathStr = vscode.workspace.asRelativePath(uri, false);
    }

    // Normalize separators for cross-OS Quick Open compatibility
    pathStr = pathStr.replace(/\\/g, '/');

    // VS Code uses 1-based line/column for quick open (path:line[:column])
    const position = editor.selection.active;
    const line = position.line + 1;
    const column = position.character + 1;
    const textToCopy = includeColumn ? `${pathStr}:${line}:${column}` : `${pathStr}:${line}`;

    await vscode.env.clipboard.writeText(textToCopy);
    vscode.window.showInformationMessage(`Copied: ${textToCopy}`);
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
