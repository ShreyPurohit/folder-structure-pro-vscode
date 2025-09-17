import * as path from 'path';
import * as vscode from 'vscode';
import { ERROR_MESSAGES } from '../constants';
import { StructureService } from '../services/structure';
import { FileSystemService } from '../services/fileSystem';
import { OutputFormat, WebviewMessage } from '../types';
import { WebviewManager } from '../ui/webview';

const FORMAT_OPTIONS: OutputFormat[] = ['Plain Text Format', 'JSON Format'];

export async function createStructure(): Promise<void> {
    try {
        const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const pick = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri,
            openLabel: 'Select target folder'
        });

        const resolvedPath = pick?.[0]?.fsPath;
        if (!resolvedPath) {
            throw new Error(ERROR_MESSAGES.TARGET_REQUIRED);
        }

        const formatChoice = await vscode.window.showQuickPick(FORMAT_OPTIONS, {
            placeHolder: 'Choose the format of the folder structure',
        }) as OutputFormat;

        if (!formatChoice) {
            return;
        }

        const panel = WebviewManager.createStructureInputPanel(formatChoice);

        panel.webview.onDidReceiveMessage(async (message: WebviewMessage | any) => {
            if (message.command === 'validate') {
                if (formatChoice === 'Plain Text Format') {
                    const { structure, invalidLines } = StructureService.parsePlainTextToStructure(message.text ?? '');
                    const preview = StructureService.formatAsTree(structure);
                    const hasContent = Object.keys(structure).length > 0;
                    panel.webview.postMessage({
                        command: 'validationResult',
                        valid: invalidLines.length === 0 && hasContent,
                        invalidLines,
                        preview,
                        errorMessage: hasContent ? undefined : 'Empty input or no valid lines.'
                    });
                } else {
                    try {
                        const obj = JSON.parse(message.text ?? '{}');
                        const valid = StructureService.validateJsonStructure(obj);
                        const preview = valid ? StructureService.formatAsTree(obj) : '';
                        panel.webview.postMessage({
                            command: 'validationResult',
                            valid,
                            invalidLines: [],
                            preview,
                            errorMessage: valid ? undefined : 'JSON structure must be nested objects with string file types.'
                        });
                    } catch (e) {
                        panel.webview.postMessage({
                            command: 'validationResult',
                            valid: false,
                            invalidLines: [],
                            preview: '',
                            errorMessage: 'Invalid JSON: ' + (e as Error).message
                        });
                    }
                }
            } else if (message.command === 'submit') {
                try {
                    // Determine existing targets and prompt for replacement
                    let targets: string[] = [];
                    if (formatChoice === 'Plain Text Format') {
                        const { structure, invalidLines } = StructureService.parsePlainTextToStructure(message.text ?? '');
                        const hasContent = Object.keys(structure).length > 0;
                        if (invalidLines.length > 0 || !hasContent) {
                            const detail = !hasContent ? 'Empty input' : `Invalid lines: ${invalidLines.join(', ')}`;
                            const confirm = await vscode.window.showWarningMessage(
                                `The input appears invalid (${detail}). Continue and create only recognized items?`,
                                { modal: true },
                                'Yes',
                                'No'
                            );
                            if (confirm !== 'Yes') { return; }
                        }
                        targets = Object.keys(structure).map(k => k);
                    } else {
                        try {
                            const obj = JSON.parse(message.text ?? '{}');
                            if (!StructureService.validateJsonStructure(obj)) {
                                vscode.window.showErrorMessage('Invalid JSON structure. Please use nested objects and string file types for files.');
                                return;
                            }
                            targets = Object.keys(obj);
                        } catch (e) {
                            vscode.window.showErrorMessage('Invalid JSON: ' + (e as Error).message);
                            return;
                        }
                    }

                    const existing: string[] = [];
                    for (const name of targets) {
                        const full = path.join(resolvedPath, name);
                        if (await FileSystemService.exists(full)) {
                            existing.push(name);
                        }
                    }

                    if (existing.length > 0) {
                        const selection = await vscode.window.showWarningMessage(
                            `The following items already exist: ${existing.join(', ')}. Replace them? (Replaced items go to Trash)`,
                            { modal: true },
                            'Replace',
                            'Skip',
                            'Cancel'
                        );
                        if (selection === 'Cancel' || !selection) { return; }
                        if (selection === 'Replace') {
                            for (const name of existing) {
                                const full = path.join(resolvedPath, name);
                                await FileSystemService.delete(full, { recursive: true, useTrash: true });
                            }
                        }
                        // On 'Skip', continue without deleting and we won't overwrite existing files
                    }

                    await StructureService.createStructure(resolvedPath, message.text, formatChoice);
                    vscode.window.showInformationMessage('Project created successfully!');
                    panel.dispose();
                } catch (error) {
                    vscode.window.showErrorMessage(`Error processing folder structure: ${(error as Error).message}`);
                }
            } else if (message.command === 'copyPreview') {
                try {
                    await vscode.env.clipboard.writeText(message.text ?? '');
                    vscode.window.showInformationMessage('Preview copied to clipboard');
                } catch (e) {
                    vscode.window.showErrorMessage('Failed to copy preview');
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
