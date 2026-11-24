import * as vscode from 'vscode';
import {
    fileLeafToFileNames,
    FolderFileSystemError,
    isDirectoryNode,
    isFileLeaf,
    StructureCreationExecutionError,
    StructureCreationValidationError,
    type CreationConflictResolution,
    type StructureCreationResult,
    type StructureInputResult,
} from '@folder-structure-pro/core';
import type { FolderStructure } from '../types';
import { CLI_COMMAND, CLI_PACKAGE_URL, DEFAULT_OUTPUT_FORMAT, ERROR_MESSAGES } from '../constants';
import { StructureService } from '../services/structure';
import { OutputFormat } from '../types';
import { createStructureInputPanel, type DestinationLabel } from '../ui/webview';

type InvalidStructure = Extract<StructureInputResult, { ok: false }>;

interface PanelMessage {
    command?: string;
    text?: string;
    format?: OutputFormat;
}

/** How many conflicting paths are named in the replace dialog. */
const LISTED_CONFLICTS = 5;

function countLabel(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

/** The problems with a structure, one line each, for the preview pane and error messages. */
function describeProblem(problem: InvalidStructure): string {
    if (problem.invalidLines.length === 0) {
        return problem.message;
    }
    return [
        `${countLabel(problem.invalidLines.length, 'line', 'lines')} could not be read:`,
        ...problem.invalidLines.map(({ line, text }) => `Line ${line}: ${text.trim()}`),
    ].join('\n');
}

/** How many folders and files a structure describes, for the webview summary. */
function countEntries(structure: FolderStructure): { folders: number; files: number } {
    let folders = 0;
    let files = 0;
    const visit = (node: FolderStructure): void => {
        for (const [name, value] of Object.entries(node)) {
            if (isDirectoryNode(value)) {
                folders++;
                visit(value);
            } else if (isFileLeaf(value)) {
                files += fileLeafToFileNames(name, value).length;
            }
        }
    };
    visit(structure);
    return { folders, files };
}

function labelFor(uri: vscode.Uri): DestinationLabel {
    const segments = uri.path.split('/').filter(Boolean);
    return { path: uri.fsPath, name: segments[segments.length - 1] ?? uri.fsPath };
}

async function pickDestination(
    defaultUri: vscode.Uri | undefined,
): Promise<vscode.Uri | undefined> {
    const pick = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri,
        openLabel: 'Select target folder',
    });
    return pick?.[0];
}

function describeResult(result: StructureCreationResult): string {
    const parts = [
        `Created ${countLabel(result.directoriesCreated, 'folder', 'folders')} and ${countLabel(result.filesCreated, 'file', 'files')}`,
    ];
    if (result.filesReplaced > 0) {
        parts.push(`replaced ${countLabel(result.filesReplaced, 'file', 'files')}`);
    }
    if (result.filesSkipped > 0) {
        parts.push(`kept ${countLabel(result.filesSkipped, 'existing file', 'existing files')}`);
    }
    return `${parts.join(', ')}.`;
}

function describeError(error: unknown): string {
    if (error instanceof StructureCreationExecutionError) {
        const cause = error.cause instanceof Error ? ` Cause: ${error.cause.message}` : '';
        return error.cause instanceof Error && error.cause.name === 'AbortError'
            ? error.message.replace(/^Creation stopped at "[^"]*"\./, 'Creation was cancelled.')
            : `${error.message}${cause}`;
    }
    if (error instanceof StructureCreationValidationError) {
        return `Nothing was created. ${error.issues.join(' ')}`;
    }
    if (error instanceof FolderFileSystemError) {
        return `${error.message} (${error.code})`;
    }
    return error instanceof Error ? error.message : String(error);
}

/** Asks what to do with files that already exist. Undefined means cancel. */
async function askConflictResolution(
    conflicts: readonly { relativePath: string }[],
): Promise<CreationConflictResolution | undefined> {
    const listed = conflicts.slice(0, LISTED_CONFLICTS).map((entry) => entry.relativePath);
    const more =
        conflicts.length > listed.length ? ` and ${conflicts.length - listed.length} more` : '';
    const choice = await vscode.window.showWarningMessage(
        `${countLabel(conflicts.length, 'file already exists', 'files already exist')}: ${listed.join(', ')}${more}. Replace empties them and moves their old versions to the Trash. Skip keeps them as they are.`,
        { modal: true },
        'Replace',
        'Skip',
    );
    return choice === 'Replace' ? 'replace' : choice === 'Skip' ? 'skip' : undefined;
}

export async function createStructure(): Promise<void> {
    try {
        const firstPick = await pickDestination(vscode.workspace.workspaceFolders?.[0]?.uri);
        if (!firstPick) {
            throw new Error(ERROR_MESSAGES.TARGET_REQUIRED);
        }
        let destination: vscode.Uri = firstPick;

        const initialFormat = vscode.workspace
            .getConfiguration('folderStructure')
            .get<OutputFormat>('outputFormat', DEFAULT_OUTPUT_FORMAT);

        const panel = createStructureInputPanel(initialFormat, labelFor(destination));

        panel.webview.onDidReceiveMessage(async (received: unknown) => {
            const message = (received ?? {}) as PanelMessage;
            const format = message.format ?? initialFormat;

            if (message.command === 'validate') {
                const result = StructureService.readStructure(message.text ?? '', format);
                panel.webview.postMessage(
                    result.ok
                        ? {
                              command: 'validationResult',
                              valid: true,
                              invalidLines: [],
                              problems: [],
                              counts: countEntries(result.structure),
                              preview: StructureService.formatAsTree(result.structure),
                          }
                        : {
                              command: 'validationResult',
                              valid: false,
                              invalidLines: result.invalidLines.map(({ line }) => line),
                              problems: result.invalidLines,
                              preview: '',
                              errorMessage:
                                  result.invalidLines.length > 0 ? undefined : result.message,
                          },
                );
                return;
            }

            if (message.command === 'changeDestination') {
                const picked = await pickDestination(destination);
                if (picked) {
                    destination = picked;
                    panel.webview.postMessage({ command: 'destination', ...labelFor(picked) });
                }
                return;
            }

            if (message.command === 'copyCommand') {
                try {
                    await vscode.env.clipboard.writeText(CLI_COMMAND);
                } catch {
                    vscode.window.showErrorMessage('Failed to copy the command');
                }
                return;
            }

            if (message.command === 'learnMore') {
                await vscode.env.openExternal(vscode.Uri.parse(CLI_PACKAGE_URL));
                return;
            }

            if (message.command === 'submit') {
                try {
                    const result = StructureService.readStructure(message.text ?? '', format);
                    if (!result.ok) {
                        vscode.window.showErrorMessage(
                            `Nothing was created. ${describeProblem(result).replace(/\n/g, ' ')}`,
                        );
                        return;
                    }

                    const plan = await StructureService.planCreation(destination, result.structure);
                    let conflictResolution: CreationConflictResolution = 'skip';
                    if (plan.conflicts.length > 0) {
                        const choice = await askConflictResolution(plan.conflicts);
                        if (!choice) {
                            return;
                        }
                        conflictResolution = choice;
                    }

                    const created = await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: 'Creating folder structure',
                            cancellable: true,
                        },
                        (_progress, token) =>
                            // Core only reads `aborted`, so the token is enough; no
                            // AbortController needed (older VS Code versions lack it).
                            StructureService.executeCreation(plan, conflictResolution, {
                                get aborted() {
                                    return token.isCancellationRequested;
                                },
                            }),
                    );

                    vscode.window.showInformationMessage(describeResult(created));
                    if (created.leftoverBackups.length > 0) {
                        vscode.window.showWarningMessage(
                            `Copies of the replaced files could not be moved to the Trash: ${created.leftoverBackups.join(', ')}`,
                        );
                    }
                    panel.dispose();
                } catch (error) {
                    vscode.window.showErrorMessage(describeError(error));
                }
                return;
            }

            if (message.command === 'copyPreview') {
                try {
                    await vscode.env.clipboard.writeText(message.text ?? '');
                    vscode.window.showInformationMessage('Preview copied to clipboard');
                } catch {
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
