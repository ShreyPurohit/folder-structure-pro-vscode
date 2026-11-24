import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { announceCliOnce } from './whatsNew';

export function activate(context: vscode.ExtensionContext): void {
    registerCommands(context);
    // Not awaited: the announcement must never delay or break activation.
    announceCliOnce(context).catch(() => undefined);
}

export function deactivate(): void {}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
