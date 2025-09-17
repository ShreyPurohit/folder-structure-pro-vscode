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
    static async getStructure(dirPath: string): Promise<FolderStructure> {
        const ignoreRules = await GitignoreService.loadRules(dirPath);
        const ig = ignore().add(ignoreRules);
        const folderName = path.basename(dirPath);
        return {
            [folderName]: await this.buildStructure(dirPath, ig, dirPath)
        };
    }

    static async buildStructure(dirPath: string, ig: ReturnType<typeof ignore>, rootPath: string): Promise<FolderStructure> {
        const structure: FolderStructure = {};
        const entries = await FileSystemService.readdir(dirPath);

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relFromRoot = path.relative(rootPath, fullPath);

            if (entry.name.startsWith('.') || ig.ignores(relFromRoot)) {
                continue;
            }

            const isDir = (entry.type & vscode.FileType.Directory) === vscode.FileType.Directory;
            if (isDir) {
                structure[entry.name] = await this.buildStructure(fullPath, ig, rootPath);
            } else {
                const ext = this.fileTypeFor(entry.name);
                const base = this.baseNameFor(entry.name);
                const key = structure[base] === undefined ? base : entry.name; // avoid collision
                structure[key] = ext;
            }
        }

        return structure;
    }

    static formatStructure(structure: FolderStructure, format: OutputFormat): string {
        const formatter = format === 'Plain Text Format'
            ? new GitignestFormatter()
            : new JsonFormatter();

        return formatter.format(structure);
    }

    static formatAsTree(structure: FolderStructure): string {
        return new GitignestFormatter().format(structure);
    }

    static async createStructure(basePath: string, content: string, format: OutputFormat): Promise<void> {
        if (!content.trim()) {
            throw new Error(ERROR_MESSAGES.EMPTY_STRUCTURE);
        }

        if (format === 'Plain Text Format') {
            await this.createFromPlainText(basePath, content);
        } else {
            try {
                const structure = JSON.parse(content);
                if (!this.validateJsonStructure(structure)) {
                    throw new Error('Invalid JSON structure: use nested objects for folders and string file types for files');
                }
                await this.createFromJSON(basePath, structure);
            } catch (error) {
                throw new Error('Invalid JSON format');
            }
        }
    }

    private static async createFromPlainText(basePath: string, content: string): Promise<void> {
        const rawLines = content.split('\n');
        // Ignore the first line (header/title) regardless of its text
        const lines = rawLines.slice(1)
            .filter(line => line.trim())
            .filter(line => !line.includes('Directory structure:'));

        const pathStack: string[] = [];
        let skipped = 0;

        for (const line of lines) {
            const node = TreeParser.parseLine(line);
            if (!node || !node.name) { skipped++; continue; }

            while (pathStack.length > node.level) {
                pathStack.pop();
            }

            const fullPath = path.join(basePath, ...pathStack, node.name);

            if (node.isDirectory) {
                await FileSystemService.mkdirIfAbsent(fullPath);
                pathStack.push(node.name);
            } else {
                await FileSystemService.writeFileIfAbsent(fullPath, '');
            }
        }

        if (skipped > 0) {
            // Inform user but do not fail the operation
            vscode.window.showWarningMessage(`Some lines (${skipped}) were skipped due to unrecognized format.`);
        }
    }

    private static async createFromJSON(basePath: string, structure: FolderStructure): Promise<void> {
        for (const [key, value] of Object.entries(structure)) {
            if (typeof value === 'string') {
                const fileName = value === 'file' || value.trim() === '' ? key : `${key}.${value}`;
                const fullPath = path.join(basePath, fileName);
                await FileSystemService.writeFileIfAbsent(fullPath, '');
            } else {
                const dirPath = path.join(basePath, key);
                await FileSystemService.mkdirIfAbsent(dirPath);
                await this.createFromJSON(dirPath, value);
            }
        }
    }

    static fileTypeFor(name: string): string {
        const ext = path.extname(name);
        if (!ext) return 'file';
        return ext.replace(/^\./, '') || 'file';
    }

    static baseNameFor(name: string): string {
        const ext = path.extname(name);
        if (!ext) return name;
        return name.slice(0, -ext.length);
    }

    // Validation helpers for webview
    static parsePlainTextToStructure(content: string): { structure: FolderStructure; invalidLines: number[] } {
        const lines = content.split('\n');
        const pathStack: string[] = [];
        const structure: FolderStructure = {};
        const invalidLines: number[] = [];
        let rootSeen = 0;

        const getContext = (stack: string[]): FolderStructure => {
            let ctx = structure;
            for (const segment of stack) {
                ctx[segment] = ctx[segment] ?? {} as FolderStructure;
                ctx = ctx[segment] as FolderStructure;
            }
            return ctx;
        };

        lines.forEach((line, idx) => {
            // Always ignore the very first line as header/title
            if (idx === 0) { return; }
            if (!line.trim() || /Directory structure:/i.test(line)) { return; }
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
                ctx[node.name] = ctx[node.name] ?? {} as FolderStructure;
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
            while (pathStack.length > node.level) { pathStack.pop(); }
            const ctx = getContext(pathStack);
            if (node.isDirectory) {
                ctx[node.name] = ctx[node.name] ?? {} as FolderStructure;
                pathStack.push(node.name);
            } else {
                const type = this.fileTypeFor(node.name);
                const base = this.baseNameFor(node.name);
                const key = (ctx as any)[base] === undefined ? base : node.name;
                ctx[key] = type;
            }
        });

        return { structure, invalidLines };
    }

    static validateJsonStructure(obj: unknown): obj is FolderStructure {
        if (obj === null || typeof obj !== 'object') return false;
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (typeof k !== 'string') return false;
            if (typeof v === 'string') continue; // file leaf
            if (v === null || typeof v !== 'object') return false;
            if (!this.validateJsonStructure(v)) return false;
        }
        return true;
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
