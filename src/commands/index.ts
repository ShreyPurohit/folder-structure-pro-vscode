import * as vscode from 'vscode';
import { copyFileName } from './copyFileName';
import { copyLinePath } from './copyLinePath';
import { copyStructureAsJson, copyStructureAsPlainText } from './copyStructure';
import { createStructure } from './createStructure';
import { showWhatsNew } from '../whatsNew';

export function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.copyFileName', copyFileName),
        vscode.commands.registerCommand(
            'extension.copyFolderStructureAsPlainText',
            copyStructureAsPlainText,
        ),
        vscode.commands.registerCommand('extension.copyFolderStructureAsJson', copyStructureAsJson),
        vscode.commands.registerCommand('extension.createProjectFromStructure', createStructure),
        vscode.commands.registerCommand('extension.copyLinePath', copyLinePath),
        vscode.commands.registerCommand('extension.showWhatsNew', () => showWhatsNew(context)),
    );
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
