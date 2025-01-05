import ignore from 'ignore';
import * as path from 'path';
import { FileSystemService } from './fileSystem';

export class GitignoreService {
    static async loadRules(dirPath: string): Promise<string[]> {
        const gitignorePath = path.join(dirPath, '.gitignore');

        if (!(await FileSystemService.exists(gitignorePath))) {
            return [];
        }

        const content = await FileSystemService.readFile(gitignorePath);
        return content.split('\n').filter(Boolean);
    }

    static isIgnored(relativePath: string, rules: string[]): boolean {
        return ignore().add(rules).ignores(relativePath);
    }
}