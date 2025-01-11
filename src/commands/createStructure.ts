import * as path from 'path';
import * as vscode from 'vscode';
import { ERROR_MESSAGES } from '../constants';
import { StructureService } from '../services/structure';
import { OutputFormat, WebviewMessage } from '../types';
import { WebviewManager } from '../ui/webview';

const FORMAT_OPTIONS: OutputFormat[] = ['Plain Text Format', 'JSON Format'];

export async function createStructure(): Promise<void> {
    try {
        const targetDir = await vscode.window.showInputBox({
            placeHolder: 'Enter the target directory path to create the project',
        });

        if (!targetDir) {
            throw new Error(ERROR_MESSAGES.TARGET_REQUIRED);
        }

        const resolvedPath = path.isAbsolute(targetDir)
            ? targetDir
            : path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd(), targetDir);

        const formatChoice = await vscode.window.showQuickPick(FORMAT_OPTIONS, {
            placeHolder: 'Choose the format of the folder structure',
        }) as OutputFormat;

        if (!formatChoice) {
            return;
        }

        const panel = WebviewManager.createStructureInputPanel(formatChoice);

        panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            if (message.command === 'submit') {
                try {
                    await StructureService.createStructure(resolvedPath, message.text, formatChoice);
                    vscode.window.showInformationMessage('Project created successfully!');
                    panel.dispose();
                } catch (error) {
                    vscode.window.showErrorMessage(`Error processing folder structure: ${(error as Error).message}`);
                }
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create project: ${(error as Error).message}`);
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */