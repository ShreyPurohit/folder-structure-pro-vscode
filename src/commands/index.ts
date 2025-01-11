import * as vscode from 'vscode';
import { copyFileName } from './copyFileName';
import { copyStructure } from './copyStructure';
import { createStructure } from './createStructure';

export function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.copyFileName', copyFileName),
        vscode.commands.registerCommand('extension.copyFolderStructure', copyStructure),
        vscode.commands.registerCommand('extension.createProjectFromStructure', createStructure)
    );
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */