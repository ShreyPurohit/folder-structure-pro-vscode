export type { FileLeaf, FolderStructure, TreeNode } from '@folder-structure-pro/core';

export type OutputFormat = 'Plain Text Format' | 'JSON Format';

export interface WebviewMessage {
    command: 'submit';
    text: string;
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
