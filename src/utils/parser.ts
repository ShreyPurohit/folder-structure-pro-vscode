import { TreeNode } from "../types";

export class LineParser {
    static countIndentation(line: string): number {
        let spaces = 0;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === ' ') {
                spaces++;
            } else if (char === '│') {
                spaces += 4 - (spaces % 4);
            } else {
                break;
            }
        }
        return Math.floor(spaces / 4);
    }

    static extractName(line: string): string {
        let name = '';
        let started = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (!started) {
                if (char === '└' || char === '├') {
                    i += 3;
                    started = true;
                } else if (char !== ' ' && char !== '│') {
                    started = true;
                }
                continue;
            }
            name += char;
        }
        return name.trim();
    }
}

export class TreeParser {
    static parseLine(line: string): TreeNode | null {
        if (!line.trim()) {
            return null;
        }

        const level = LineParser.countIndentation(line);
        const name = LineParser.extractName(line);

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