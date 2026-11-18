import type { FolderStructure } from './folderStructure.js';

function stripLineComment(line: string): string {
    let inString = false;
    let index = 0;
    while (index < line.length) {
        const character = line[index];
        if (inString) {
            if (character === '\\') {
                index += 2;
                continue;
            }
            if (character === '"') {
                inString = false;
            }
        } else {
            if (character === '"') {
                inString = true;
            }
            if (character === '/' && line[index + 1] === '/') {
                if (index > 0 && /\s/.test(line[index - 1])) {
                    return line.slice(0, index).trimEnd();
                }
            }
            if (character === '#') {
                if (index > 0 && /\s/.test(line[index - 1])) {
                    return line.slice(0, index).trimEnd();
                }
            }
        }
        index++;
    }
    return line;
}

export function stripInlineComments(text: string): string {
    return text
        .split('\n')
        .map((line) => stripLineComment(line))
        .join('\n');
}

export function parseJsonWithComments(text: string): unknown {
    return JSON.parse(stripInlineComments(text)) as unknown;
}

export function validateJsonStructure(value: unknown): value is FolderStructure {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (typeof key !== 'string') {
            return false;
        }
        if (typeof child === 'string' || child === null) {
            continue;
        }
        if (Array.isArray(child)) {
            if (child.length === 0) {
                return false;
            }
            if (!child.every((item) => typeof item === 'string' || item === null)) {
                return false;
            }
            continue;
        }
        if (!validateJsonStructure(child)) {
            return false;
        }
    }
    return true;
}
