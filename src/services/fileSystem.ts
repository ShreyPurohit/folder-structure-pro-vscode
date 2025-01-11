import * as fs from 'fs';
import { DEFAULT_ENCODING } from '../constants';

export class FileSystemService {
    static async exists(path: string): Promise<boolean> {
        try {
            await fs.promises.access(path);
            return true;
        } catch {
            return false;
        }
    }

    static async isDirectory(path: string): Promise<boolean> {
        const stat = await fs.promises.stat(path);
        return stat.isDirectory();
    }

    static async readFile(path: string): Promise<string> {
        return fs.promises.readFile(path, DEFAULT_ENCODING);
    }

    static async writeFile(path: string, content: string): Promise<void> {
        return fs.promises.writeFile(path, content, DEFAULT_ENCODING);
    }

    static async mkdir(path: string): Promise<void> {
        await fs.promises.mkdir(path, { recursive: true });
    }

    static async readdir(path: string): Promise<fs.Dirent[]> {
        return fs.promises.readdir(path, { withFileTypes: true });
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */