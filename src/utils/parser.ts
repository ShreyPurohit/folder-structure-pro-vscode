import { TREE_SYMBOLS } from "../constants";
import { TreeNode } from "../types";

class LineParser {
    static countIndentation(rawLine: string): number {
        // Count indent groups made of either: "│   " or "    "
        let i = 0;
        let level = 0;
        while (i < rawLine.length) {
            const next = rawLine.slice(i);
            if (next.startsWith(TREE_SYMBOLS.VERTICAL + TREE_SYMBOLS.INDENT.slice(1)) || next.startsWith('|' + TREE_SYMBOLS.INDENT.slice(1))) {
                i += TREE_SYMBOLS.VERTICAL.length + TREE_SYMBOLS.INDENT.length - 1;
                level++;
            } else if (next.startsWith(TREE_SYMBOLS.INDENT)) {
                i += TREE_SYMBOLS.INDENT.length;
                level++;
            } else {
                break;
            }
        }
        return level;
    }

    static extractName(rawLine: string): string {
        let line = rawLine;
        // strip indent groups
        while (line.startsWith(TREE_SYMBOLS.VERTICAL + TREE_SYMBOLS.INDENT.slice(1)) || line.startsWith('|' + TREE_SYMBOLS.INDENT.slice(1)) || line.startsWith(TREE_SYMBOLS.INDENT)) {
            if (line.startsWith(TREE_SYMBOLS.VERTICAL + TREE_SYMBOLS.INDENT.slice(1)) || line.startsWith('|' + TREE_SYMBOLS.INDENT.slice(1))) {
                line = line.slice(TREE_SYMBOLS.VERTICAL.length + TREE_SYMBOLS.INDENT.length - 1);
            } else {
                line = line.slice(TREE_SYMBOLS.INDENT.length);
            }
        }
        // require a connector (strict)
        if (line.startsWith(TREE_SYMBOLS.BRANCH)) {
            line = line.slice(TREE_SYMBOLS.BRANCH.length);
        } else if (line.startsWith(TREE_SYMBOLS.LAST)) {
            line = line.slice(TREE_SYMBOLS.LAST.length);
        } else if (line.startsWith('|-- ')) { // ASCII compatibility
            line = line.slice(4);
        } else if (line.startsWith('`-- ')) {
            line = line.slice(4);
        } else {
            // no connector -> invalid
            return '';
        }
        return line.trim();
    }
}

export class TreeParser {
    static parseLine(line: string): TreeNode | null {
        if (!line.trim() || /Directory structure:/i.test(line)) {
            return null;
        }

        const level = LineParser.countIndentation(line);
        const name = LineParser.extractName(line);
        if (!name) { return null; }

        return {
            name: name.endsWith('/') ? name.slice(0, -1) : name,
            level,
            isDirectory: name.endsWith('/')
        };
    }
}

/*
 * Copyright (c) 2025 Shrey Purohit.
 * This code is licensed under the MIT License.
 */
