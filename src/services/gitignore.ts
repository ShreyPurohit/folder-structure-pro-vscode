import * as vscode from 'vscode';

export class GitignoreService {
    static getTraversalOptions(): {
        ignorePatterns: string[];
        respectGitignore: boolean;
    } {
        const config = vscode.workspace.getConfiguration('folderStructure');
        const ignorePatterns = config.get<string[]>('ignorePatterns', ['node_modules', '.*']);
        const respectGitignore = config.get<boolean>('respectGitignore', true);

        return { ignorePatterns, respectGitignore };
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
