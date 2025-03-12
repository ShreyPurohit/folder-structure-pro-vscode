import ignore from 'ignore';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileSystemService } from './fileSystem';

export class GitignoreService {
    static async loadRules(dirPath: string): Promise<string[]> {
        const config = vscode.workspace.getConfiguration('folderStructure');
        const ignorePatterns = config.get<string[]>('ignorePatterns', ['node_modules', '.*']);
        const respectGitignore = config.get<boolean>('respectGitignore', true);

        let rules = [...ignorePatterns];

        if (respectGitignore) {
            const gitignorePath = path.join(dirPath, '.gitignore');
            if (await FileSystemService.exists(gitignorePath)) {
                const content = await FileSystemService.readFile(gitignorePath);
                rules = rules.concat(content.split('\n').filter(line =>
                    line.trim() && !line.startsWith('#')
                ));
            }
        }

        return rules;
    }

    static isIgnored(relativePath: string, rules: string[]): boolean {
        const ig = ignore().add(rules);
        return ig.ignores(relativePath);
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */