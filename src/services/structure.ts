import * as path from 'path';
import { ERROR_MESSAGES } from '../constants';
import { FolderStructure, OutputFormat } from '../types';
import { TreeParser } from '../utils/parser';
import { FileSystemService } from './fileSystem';
import { GitignestFormatter, JsonFormatter } from './formatters';
import { GitignoreService } from './gitignore';

export class StructureService {
    static async getStructure(dirPath: string): Promise<FolderStructure> {
        const ignoreRules = await GitignoreService.loadRules(dirPath);
        const folderName = path.basename(dirPath);
        return {
            [folderName]: await this.buildStructure(dirPath, ignoreRules)
        };
    }

    static async buildStructure(dirPath: string, ignoreRules: string[]): Promise<FolderStructure> {
        const structure: FolderStructure = {};
        const entries = await FileSystemService.readdir(dirPath);

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(dirPath, fullPath);

            if (entry.name.startsWith('.') || GitignoreService.isIgnored(relativePath, ignoreRules)) {
                continue;
            }

            structure[entry.name] = entry.isDirectory()
                ? await this.buildStructure(fullPath, ignoreRules)
                : null;
        }

        return structure;
    }

    static formatStructure(structure: FolderStructure, format: OutputFormat): string {
        const formatter = format === 'Plain Text Format'
            ? new GitignestFormatter()
            : new JsonFormatter();

        return formatter.format(structure);
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
                if (typeof structure !== 'object' || structure === null) {
                    throw new Error('Invalid JSON structure');
                }
                await this.createFromJSON(basePath, structure);
            } catch (error) {
                throw new Error('Invalid JSON format');
            }
        }
    }

    private static async createFromPlainText(basePath: string, content: string): Promise<void> {
        const lines = content.split('\n')
            .filter(line => line.trim())
            .filter(line => !line.includes('Directory structure:'));

        const pathStack: string[] = [];

        for (const line of lines) {
            const node = TreeParser.parseLine(line);
            if (!node) { continue; }

            while (pathStack.length > node.level) {
                pathStack.pop();
            }

            const fullPath = path.join(basePath, ...pathStack, node.name);

            if (node.isDirectory) {
                await FileSystemService.mkdir(fullPath);
                pathStack.push(node.name);
            } else {
                await FileSystemService.writeFile(fullPath, '');
            }
        }
    }

    private static async createFromJSON(basePath: string, structure: FolderStructure): Promise<void> {
        for (const [key, value] of Object.entries(structure)) {
            const fullPath = path.join(basePath, key);
            if (value === null) {
                await FileSystemService.writeFile(fullPath, '');
            } else {
                await FileSystemService.mkdir(fullPath);
                await this.createFromJSON(fullPath, value);
            }
        }
    }
}