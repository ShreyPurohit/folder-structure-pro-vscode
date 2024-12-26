import * as vscode from 'vscode';
import copyFileName from './copyFileName';
import copyFolderStructure from './copyStructure';
import createProjectFromStructure from './createStructure';

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(copyFolderStructure);
	context.subscriptions.push(createProjectFromStructure);
	context.subscriptions.push(copyFileName);
}

/*
 * Copyright (c) 2024 Shrey Purohit.
 * This code is licensed under the MIT License.
 */