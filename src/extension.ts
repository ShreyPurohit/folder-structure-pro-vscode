import * as vscode from 'vscode';
import copyFolderStructure from './copyStructure';
import createProjectFromStructure from './createStructure';

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(copyFolderStructure);
	context.subscriptions.push(createProjectFromStructure);
}

/*
 * Copyright (c) 2024 Shrey Purohit.
 * This code is licensed under the MIT License.
 */