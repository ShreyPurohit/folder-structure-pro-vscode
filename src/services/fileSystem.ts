import * as vscode from 'vscode';
import { DEFAULT_ENCODING } from '../constants';

type DirEntry = { name: string; type: vscode.FileType };

export class FileSystemService {
    private static toUri(inputPath: string | vscode.Uri): vscode.Uri {
        return inputPath instanceof vscode.Uri ? inputPath : vscode.Uri.file(inputPath);
    }

    static async exists(inputPath: string | vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(this.toUri(inputPath));
            return true;
        } catch {
            return false;
        }
    }

    static async isDirectory(inputPath: string | vscode.Uri): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(this.toUri(inputPath));
            return (stat.type & vscode.FileType.Directory) === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }

    static async readFile(inputPath: string | vscode.Uri): Promise<string> {
        const data = await vscode.workspace.fs.readFile(this.toUri(inputPath));
        return new TextDecoder(DEFAULT_ENCODING).decode(data);
    }

    static async writeFile(inputPath: string | vscode.Uri, content: string): Promise<void> {
        const data = new TextEncoder().encode(content);
        await vscode.workspace.fs.writeFile(this.toUri(inputPath), data);
    }

    static async writeFileIfAbsent(inputPath: string | vscode.Uri, content: string): Promise<void> {
        const uri = this.toUri(inputPath);
        const exists = await this.exists(uri);
        if (exists) { return; } // do not overwrite existing files
        await this.writeFile(uri, content);
    }

    static async mkdir(inputPath: string | vscode.Uri): Promise<void> {
        await vscode.workspace.fs.createDirectory(this.toUri(inputPath));
    }

    static async mkdirIfAbsent(inputPath: string | vscode.Uri): Promise<void> {
        // createDirectory is idempotent in VS Code fs; this wrapper clarifies intent
        await this.mkdir(inputPath);
    }

    static async readdir(inputPath: string | vscode.Uri): Promise<DirEntry[]> {
        const entries = await vscode.workspace.fs.readDirectory(this.toUri(inputPath));
        return entries.map(([name, type]) => ({ name, type }));
    }

    static async delete(inputPath: string | vscode.Uri, opts: { recursive?: boolean; useTrash?: boolean } = { recursive: true, useTrash: true }): Promise<void> {
        await vscode.workspace.fs.delete(this.toUri(inputPath), { recursive: opts.recursive ?? true, useTrash: opts.useTrash ?? true });
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
