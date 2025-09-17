export interface FolderStructure {
    // key: name
    // value: nested FolderStructure for directories, or string file type (e.g., "ts", "css") for files
    [key: string]: FolderStructure | string;
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
