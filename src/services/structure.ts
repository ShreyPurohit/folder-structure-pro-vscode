import * as path from 'path';
import * as vscode from 'vscode';
import {
    executeStructureCreation,
    formatJson,
    formatPlainText,
    parseStructureInput,
    planStructureCreation,
    traverseFolderStructure,
    type CreationAbortSignal,
    type CreationConflictResolution,
    type StructureCreationPlan,
    type StructureCreationResult,
    type StructureInputResult,
} from '@folder-structure-pro/core';
import { FolderStructure, OutputFormat } from '../types';
import { GitignoreService } from './gitignore';
import { VSCodeFileSystemAdapter } from '../adapters/vscodeFileSystem';

export class StructureService {
    static async getStructure(dirUri: vscode.Uri): Promise<FolderStructure> {
        const fileSystem = new VSCodeFileSystemAdapter();
        return traverseFolderStructure(
            fileSystem,
            fileSystem.toFolderPath(dirUri),
            GitignoreService.getTraversalOptions(),
        );
    }

    static formatStructure(structure: FolderStructure, format: OutputFormat): string {
        return format === 'Plain Text Format' ? formatPlainText(structure) : formatJson(structure);
    }

    static formatAsTree(structure: FolderStructure): string {
        return formatPlainText(structure);
    }

    /**
     * Reads a structure the user typed or pasted, with the shared core rules. `format`
     * is the one chosen in the webview.
     */
    static readStructure(text: string, format: OutputFormat): StructureInputResult {
        return parseStructureInput(text, {
            format: format === 'JSON Format' ? 'json' : 'text',
            parserOptions: {
                getFileType: (name) => this.fileTypeFor(name),
                getBaseName: (name) => this.baseNameFor(name),
            },
        });
    }

    /** Checks the structure against the destination: safe names, and what already exists. */
    static async planCreation(
        destination: vscode.Uri,
        structure: FolderStructure,
    ): Promise<StructureCreationPlan> {
        const fileSystem = new VSCodeFileSystemAdapter();
        return planStructureCreation(fileSystem, fileSystem.toFolderPath(destination), structure);
    }

    /** Creates the planned structure, all or nothing. */
    static async executeCreation(
        plan: StructureCreationPlan,
        conflictResolution: CreationConflictResolution,
        signal?: CreationAbortSignal,
    ): Promise<StructureCreationResult> {
        return executeStructureCreation(new VSCodeFileSystemAdapter(), plan, conflictResolution, {
            signal,
        });
    }

    static fileTypeFor(name: string): string {
        const extension = path.extname(name);
        if (!extension) {
            return 'file';
        }
        return extension.replace(/^\./, '') || 'file';
    }

    static baseNameFor(name: string): string {
        const extension = path.extname(name);
        return extension ? name.slice(0, -extension.length) : name;
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
