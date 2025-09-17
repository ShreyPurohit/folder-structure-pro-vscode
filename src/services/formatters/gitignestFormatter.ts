import { FolderStructure } from '../../types';
import { BaseFormatter } from './baseFormatter';
import { TREE_SYMBOLS } from '../../constants';

// Unicode tree for better readability (GitIngest style)
// Connectors: ├──, └── and vertical guide │
export class GitignestFormatter extends BaseFormatter {
    format(structure: FolderStructure): string {
        const body = this.formatStructure(structure, '', true);
        return `Directory structure:\n${body}`;
    }

    private formatStructure(structure: FolderStructure, prefix: string, isRoot = false): string {
        const entries = Object.entries(structure);
        return entries
            .map(([name, value], idx) => {
                const isLast = idx === entries.length - 1;
                const connector = isRoot ? TREE_SYMBOLS.LAST : (isLast ? TREE_SYMBOLS.LAST : TREE_SYMBOLS.BRANCH);
                const isDir = typeof value === 'object' && value !== null;
                const displayName = !isDir
                    ? ((value as string) === 'file' || (value as string).trim() === '' ? name : `${name}.${value as string}`)
                    : `${name}/`;
                const line = `${isRoot ? '' : prefix}${connector}${displayName}`;

                if (!isDir) {
                    return line;
                }

                const childPrefix = isRoot
                    ? TREE_SYMBOLS.INDENT
                    : prefix + (isLast ? TREE_SYMBOLS.INDENT : `${TREE_SYMBOLS.VERTICAL}${TREE_SYMBOLS.INDENT.slice(1)}`);
                const nested = this.formatStructure(value as FolderStructure, childPrefix);
                return `${line}\n${nested}`;
            })
            .join('\n');
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
