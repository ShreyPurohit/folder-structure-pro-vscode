import * as path from 'path';
import * as vscode from 'vscode';
import {
    formatJson,
    formatPlainText,
    isDirectoryNode,
    isFileLeaf,
    normalizeFileLeafExtensions,
    parseJsonWithComments,
    parsePlainTextToStructure,
    stripInlineComments,
    traverseFolderStructure,
    TreeParser,
    validateJsonStructure,
} from '@folder-structure-pro/core';
import { ERROR_MESSAGES } from '../constants';
import { FolderStructure, OutputFormat } from '../types';
import { FileSystemService } from './fileSystem';
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

    static stripInlineComments(text: string): string {
        return stripInlineComments(text);
    }

    static parseJsonStructure(text: string): unknown {
        return parseJsonWithComments(text);
    }

    static async createStructure(
        baseUri: vscode.Uri,
        content: string,
        format: OutputFormat,
    ): Promise<void> {
        if (!content.trim()) {
            throw new Error(ERROR_MESSAGES.EMPTY_STRUCTURE);
        }

        if (format === 'Plain Text Format') {
            await this.createFromPlainText(baseUri, content);
        } else {
            try {
                const structure = this.parseJsonStructure(content);
                if (!this.validateJsonStructure(structure)) {
                    throw new Error(
                        'Invalid JSON structure: use nested objects for folders and string file types for files',
                    );
                }
                await this.createFromJSON(baseUri, structure);
            } catch (error) {
                throw new Error('Invalid JSON format');
            }
        }
    }

    private static async createFromPlainText(baseUri: vscode.Uri, content: string): Promise<void> {
        const rawLines = content.split('\n');
        // Ignore the first line (header/title) regardless of its text
        const lines = rawLines
            .slice(1)
            .filter((line) => line.trim())
            .filter((line) => !line.includes('Directory structure:'));

        const pathStack: string[] = [];
        let skipped = 0;

        for (const line of lines) {
            const node = TreeParser.parseLine(line);
            if (!node || !node.name) {
                skipped++;
                continue;
            }

            while (pathStack.length > node.level) {
                pathStack.pop();
            }

            const fullPath = vscode.Uri.joinPath(baseUri, ...pathStack, node.name);

            if (node.isDirectory) {
                await FileSystemService.mkdirIfAbsent(fullPath);
                pathStack.push(node.name);
            } else {
                await FileSystemService.writeFileIfAbsent(fullPath, '');
            }
        }

        if (skipped > 0) {
            // Inform user but do not fail the operation
            vscode.window.showWarningMessage(
                `Some lines (${skipped}) were skipped due to unrecognized format.`,
            );
        }
    }

    private static async createFromJSON(
        baseUri: vscode.Uri,
        structure: FolderStructure,
    ): Promise<void> {
        for (const [key, value] of Object.entries(structure)) {
            if (isDirectoryNode(value)) {
                const dirPath = vscode.Uri.joinPath(baseUri, key);
                await FileSystemService.mkdirIfAbsent(dirPath);
                await this.createFromJSON(dirPath, value);
                continue;
            }
            if (!isFileLeaf(value)) {
                continue;
            }
            const uniqueExtensions = Array.from(new Set(normalizeFileLeafExtensions(value)));
            for (const extension of uniqueExtensions) {
                const fileName = extension === 'file' ? key : `${key}.${extension}`;
                const fullPath = vscode.Uri.joinPath(baseUri, fileName);
                await FileSystemService.writeFileIfAbsent(fullPath, '');
            }
        }
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

    static parsePlainTextToStructure(content: string): {
        structure: FolderStructure;
        invalidLines: number[];
    } {
        return parsePlainTextToStructure(content, {
            getFileType: (name) => this.fileTypeFor(name),
            getBaseName: (name) => this.baseNameFor(name),
        });
    }

    static validateJsonStructure(obj: unknown): obj is FolderStructure {
        return validateJsonStructure(obj);
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
