import { FolderStructure } from '../../types';
import { BaseFormatter } from './baseFormatter';

export class GitignestFormatter extends BaseFormatter {
    format(structure: FolderStructure, level = 0): string {
        if (level === 0) {
            return 'Directory structure:\n' + this.formatStructure(structure);
        }
        return this.formatStructure(structure, level);
    }

    private formatStructure(structure: FolderStructure, level = 0): string {
        return Object.entries(structure)
            .map(([key, value], index, array) => {
                const isLast = index === array.length - 1;
                const indent = ' '.repeat(level * 4);
                const prefix = level === 0 ? '└── ' : isLast ? '└── ' : '├── ';
                const line = `${indent}${prefix}${key}${value ? '/' : ''}`;

                if (!value) {
                    return line;
                }

                const childConnector = isLast ? ' ' : '│';
                const nested = this.formatStructure(value, level + 1)
                    .split('\n')
                    .filter(Boolean)
                    .map(line => `${indent}${childConnector}${line.slice(indent.length)}`)
                    .join('\n');

                return `${line}\n${nested}`;
            })
            .join('\n');
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */