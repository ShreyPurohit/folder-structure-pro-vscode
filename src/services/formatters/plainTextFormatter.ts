import { FileLeaf, FolderStructure } from '../../types';
import { BaseFormatter } from './baseFormatter';
import { TREE_SYMBOLS } from '../../constants';
import { fileLeafToDisplayNames, isDirectoryNode } from '../../utils/folderStructure';

export class PlainTextFormatter extends BaseFormatter {
    format(structure: FolderStructure): string {
        const body = this.formatStructure(structure, '', true);
        return `Directory structure:\n${body}`;
    }

    private formatStructure(structure: FolderStructure, prefix: string, isRoot = false): string {
        const entries = Object.entries(structure);
        return entries
            .map(([name, value], idx) => {
                const isLastEntry = idx === entries.length - 1;
                if (isDirectoryNode(value)) {
                    return this.formatDirectoryEntry(name, value, prefix, isRoot, isLastEntry);
                }
                return this.formatFileLeafEntry(name, value, prefix, isRoot, isLastEntry);
            })
            .join('\n');
    }

    private formatDirectoryEntry(
        name: string,
        value: FolderStructure,
        prefix: string,
        isRoot: boolean,
        isLastEntry: boolean,
    ): string {
        const connector = isLastEntry ? TREE_SYMBOLS.LAST : TREE_SYMBOLS.BRANCH;
        const line = `${isRoot ? '' : prefix}${connector}${name}/`;
        const childPrefix = isRoot
            ? TREE_SYMBOLS.INDENT
            : prefix +
              (isLastEntry
                  ? TREE_SYMBOLS.INDENT
                  : `${TREE_SYMBOLS.VERTICAL}${TREE_SYMBOLS.INDENT.slice(1)}`);
        const nested = this.formatStructure(value, childPrefix);
        const trailingNewline = isRoot && !isLastEntry ? '\n' : '';
        return `${line}\n${nested}${trailingNewline}`;
    }

    private formatFileLeafEntry(
        name: string,
        value: FileLeaf,
        prefix: string,
        isRoot: boolean,
        isLastEntry: boolean,
    ): string {
        const displayNames = fileLeafToDisplayNames(name, value);
        return displayNames
            .map((displayName, index) => {
                const isLastLine = isLastEntry && index === displayNames.length - 1;
                const connector = isLastLine ? TREE_SYMBOLS.LAST : TREE_SYMBOLS.BRANCH;
                return `${isRoot ? '' : prefix}${connector}${displayName}`;
            })
            .join('\n');
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
