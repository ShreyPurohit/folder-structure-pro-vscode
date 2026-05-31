export type FileLeaf = string | string[] | null;

export interface FolderStructure {
    [key: string]: FolderStructure | FileLeaf;
}

export type OutputFormat = 'Plain Text Format' | 'JSON Format';

export interface WebviewMessage {
    command: 'submit';
    text: string;
}

export interface TreeNode {
    name: string;
    level: number;
    isDirectory: boolean;
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
