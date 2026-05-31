import ignore from 'ignore';
import * as path from 'path';
import * as vscode from 'vscode';
import { ERROR_MESSAGES } from '../constants';
import { FolderStructure, OutputFormat, TreeNode } from '../types';
import { TreeParser } from '../utils/parser';
import { FileSystemService } from './fileSystem';
import { GitignestFormatter, JsonFormatter } from './formatters';
import { GitignoreService } from './gitignore';

export class StructureService {
    private static relativeFromRoot(rootUri: vscode.Uri, targetUri: vscode.Uri): string {
        const root = rootUri.path.replace(/\/+$/, '');
        const target = targetUri.path;
        if (!target.startsWith(root)) {
            return target.replace(/^\/+/, '');
        }
        return target.slice(root.length).replace(/^\/+/, '');
    }

    private static uriBaseName(uri: vscode.Uri): string {
        const segments = uri.path.split('/').filter(Boolean);
        return segments[segments.length - 1] ?? uri.path;
    }

    static async getStructure(dirUri: vscode.Uri): Promise<FolderStructure> {
        const ignoreRules = await GitignoreService.loadRules(dirUri);
        const ig = ignore().add(ignoreRules);
        const folderName = this.uriBaseName(dirUri);
        return {
            [folderName]: await this.buildStructure(dirUri, ig, dirUri),
        };
    }

    static async buildStructure(
        dirUri: vscode.Uri,
        ig: ReturnType<typeof ignore>,
        rootUri: vscode.Uri,
    ): Promise<FolderStructure> {
        const structure: FolderStructure = {};
        const entries = await FileSystemService.readdir(dirUri);

        for (const entry of entries) {
            const fullUri = vscode.Uri.joinPath(dirUri, entry.name);
            const relFromRoot = this.relativeFromRoot(rootUri, fullUri);

            if (entry.name.startsWith('.') || ig.ignores(relFromRoot)) {
                continue;
            }

            const isDir = (entry.type & vscode.FileType.Directory) === vscode.FileType.Directory;
            if (isDir) {
                structure[entry.name] = await this.buildStructure(fullUri, ig, rootUri);
            } else {
                const ext = this.fileTypeFor(entry.name);
                const base = this.baseNameFor(entry.name);
                const existing = structure[base] as string[] | string | undefined;
                structure[base] =
                    existing === undefined
                        ? ext
                        : Array.isArray(existing)
                          ? [...existing, ext]
                          : [existing, ext];
            }
        }

        return structure;
    }

    static formatStructure(structure: FolderStructure, format: OutputFormat): string {
        const formatter =
            format === 'Plain Text Format' ? new GitignestFormatter() : new JsonFormatter();

        return formatter.format(structure);
    }

    static formatAsTree(structure: FolderStructure): string {
        return new GitignestFormatter().format(structure);
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
                const structure = JSON.parse(content);
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
            if (Array.isArray(value) || typeof value === 'string') {
                const uniqueTypes = Array.from(new Set(Array.isArray(value) ? value : [value]));
                for (const val of uniqueTypes) {
                    const fileName = val === 'file' || val.trim() === '' ? key : `${key}.${val}`;
                    const fullPath = vscode.Uri.joinPath(baseUri, fileName);
                    await FileSystemService.writeFileIfAbsent(fullPath, '');
                }
            } else {
                const dirPath = vscode.Uri.joinPath(baseUri, key);
                await FileSystemService.mkdirIfAbsent(dirPath);
                await this.createFromJSON(dirPath, value);
            }
        }
    }

    static fileTypeFor(name: string): string {
        const ext = path.extname(name);
        if (!ext) {
            return 'file';
        }
        return ext.replace(/^\./, '') || 'file';
    }

    static baseNameFor(name: string): string {
        const ext = path.extname(name);
        if (!ext) {
            return name;
        }
        return name.slice(0, -ext.length);
    }

    // Validation helpers for webview
    static parsePlainTextToStructure(content: string): {
        structure: FolderStructure;
        invalidLines: number[];
    } {
        const lines = content.split('\n');
        const pathStack: string[] = [];
        const structure: FolderStructure = {};
        const invalidLines: number[] = [];
        let rootSeen = 0;

        const getContext = (stack: string[]): FolderStructure => {
            let ctx = structure;
            for (const segment of stack) {
                ctx[segment] = ctx[segment] ?? ({} as FolderStructure);
                ctx = ctx[segment] as FolderStructure;
            }
            return ctx;
        };

        lines.forEach((line, idx) => {
            // Always ignore the very first line as header/title
            if (idx === 0) {
                return;
            }
            if (!line.trim() || /Directory structure:/i.test(line)) {
                return;
            }
            const node: TreeNode | null = TreeParser.parseLine(line);
            if (!node || !node.name) {
                invalidLines.push(idx + 1);
                return;
            }

            if (node.level === 0) {
                // enforce exactly one root, and it must be a directory
                if (!node.isDirectory) {
                    invalidLines.push(idx + 1);
                    return;
                }
                rootSeen++;
                if (rootSeen > 1) {
                    invalidLines.push(idx + 1);
                    return;
                }
                pathStack.length = 0;
                const ctx = getContext([]);
                ctx[node.name] = ctx[node.name] ?? ({} as FolderStructure);
                pathStack.push(node.name);
                return;
            }

            // going deeper must be exactly +1 level
            if (node.level > pathStack.length) {
                if (node.level !== pathStack.length + 1) {
                    invalidLines.push(idx + 1);
                    return;
                }
            }
            while (pathStack.length > node.level) {
                pathStack.pop();
            }
            const ctx = getContext(pathStack);
            if (node.isDirectory) {
                ctx[node.name] = ctx[node.name] ?? ({} as FolderStructure);
                pathStack.push(node.name);
            } else {
                const type = this.fileTypeFor(node.name);
                const base = this.baseNameFor(node.name);
                const existing = ctx[base] as string[] | string | undefined;
                ctx[base] =
                    existing === undefined
                        ? type
                        : Array.isArray(existing)
                          ? [...existing, type]
                          : [existing, type];
            }
        });

        return { structure, invalidLines };
    }

    static validateJsonStructure(obj: unknown): obj is FolderStructure {
        if (obj === null || typeof obj !== 'object') {
            return false;
        }
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (typeof k !== 'string') {
                return false;
            }
            if (typeof v === 'string') {
                continue;
            } // file leaf
            if (v === null || typeof v !== 'object') {
                return false;
            }
            if (!this.validateJsonStructure(v)) {
                return false;
            }
        }
        return true;
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
