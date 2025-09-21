import * as vscode from 'vscode';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
    registerCommands(context);
}

export function deactivate(): void {}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
