import type { FolderStructure, TreeNode } from './folderStructure.js';
import {
    baseNameFor,
    fileLeafToFileNames,
    fileTypeFor,
    isDirectoryNode,
    isFileLeaf,
    mergeFileExtension,
} from './folderStructure.js';

const TREE_SYMBOLS = {
    VERTICAL: '│',
    BRANCH: '├── ',
    LAST: '└── ',
    INDENT: '    ',
} as const;

class LineParser {
    static countIndentation(rawLine: string): number {
        let i = 0;
        let level = 0;
        while (i < rawLine.length) {
            const next = rawLine.slice(i);
            if (
                next.startsWith(TREE_SYMBOLS.VERTICAL + TREE_SYMBOLS.INDENT.slice(1)) ||
                next.startsWith('|' + TREE_SYMBOLS.INDENT.slice(1))
            ) {
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
        while (
            line.startsWith(TREE_SYMBOLS.VERTICAL + TREE_SYMBOLS.INDENT.slice(1)) ||
            line.startsWith('|' + TREE_SYMBOLS.INDENT.slice(1)) ||
            line.startsWith(TREE_SYMBOLS.INDENT)
        ) {
            if (
                line.startsWith(TREE_SYMBOLS.VERTICAL + TREE_SYMBOLS.INDENT.slice(1)) ||
                line.startsWith('|' + TREE_SYMBOLS.INDENT.slice(1))
            ) {
                line = line.slice(TREE_SYMBOLS.VERTICAL.length + TREE_SYMBOLS.INDENT.length - 1);
            } else {
                line = line.slice(TREE_SYMBOLS.INDENT.length);
            }
        }
        if (line.startsWith(TREE_SYMBOLS.BRANCH)) {
            line = line.slice(TREE_SYMBOLS.BRANCH.length);
        } else if (line.startsWith(TREE_SYMBOLS.LAST)) {
            line = line.slice(TREE_SYMBOLS.LAST.length);
        } else if (line.startsWith('|-- ')) {
            line = line.slice(4);
        } else if (line.startsWith('`-- ')) {
            line = line.slice(4);
        } else {
            return '';
        }
        // Space-prefixed markers remain ambiguous with names such as "file #draft.ts".
        line = line.replace(/ +(\/\/|#).*$/, '');
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
        if (!name) {
            return null;
        }

        return {
            name: name.endsWith('/') ? name.slice(0, -1) : name,
            level,
            isDirectory: name.endsWith('/'),
        };
    }
}

export interface PlainTextParseResult {
    structure: FolderStructure;
    invalidLines: number[];
}

export interface PlainTextParserOptions {
    getFileType?: (name: string) => string;
    getBaseName?: (name: string) => string;
}

function setFileExtension(
    context: FolderStructure,
    baseName: string,
    extension: string,
    fullName?: string,
): void {
    if (isDirectoryNode(context[baseName])) {
        const actualName =
            fullName ?? (extension === 'file' ? baseName : `${baseName}.${extension}`);
        context[actualName] = null;
        return;
    }
    const current = context[baseName];
    const currentLeaf = isFileLeaf(current) ? current : undefined;
    context[baseName] = mergeFileExtension(currentLeaf, extension);
}

export function parsePlainTextToStructure(
    content: string,
    options: PlainTextParserOptions = {},
): PlainTextParseResult {
    const lines = content.split('\n');
    const pathStack: string[] = [];
    const structure: FolderStructure = {};
    const invalidLines: number[] = [];
    const getFileType = options.getFileType ?? fileTypeFor;
    const getBaseName = options.getBaseName ?? baseNameFor;

    const getContext = (stack: string[]): FolderStructure =>
        stack.reduce<FolderStructure>((context, segment) => {
            const next = (context[segment] ?? {}) as FolderStructure;
            context[segment] = next;
            return next;
        }, structure);

    lines.forEach((line, index) => {
        if (index === 0) {
            return;
        }
        if (!line.trim() || /Directory structure:/i.test(line)) {
            return;
        }
        const node: TreeNode | null = TreeParser.parseLine(line);
        if (!node || !node.name) {
            const hasConnector = /├|└|\|--|`--/.test(line);
            if (hasConnector) {
                invalidLines.push(index + 1);
            }
            return;
        }

        if (node.level === 0) {
            pathStack.length = 0;
            const context = getContext([]);
            if (node.isDirectory) {
                if (isFileLeaf(context[node.name])) {
                    const previousLeaf = context[node.name];
                    if (isFileLeaf(previousLeaf)) {
                        delete context[node.name];
                        for (const fileName of fileLeafToFileNames(node.name, previousLeaf)) {
                            context[fileName] = null;
                        }
                    }
                }
                context[node.name] = context[node.name] ?? {};
                pathStack.push(node.name);
            } else {
                const type = getFileType(node.name);
                const baseName = getBaseName(node.name);
                setFileExtension(context, baseName, type, node.name);
            }
            return;
        }

        if (node.level > pathStack.length && node.level !== pathStack.length + 1) {
            invalidLines.push(index + 1);
            return;
        }
        while (pathStack.length > node.level) {
            pathStack.pop();
        }
        const context = getContext(pathStack);
        if (node.isDirectory) {
            if (isFileLeaf(context[node.name])) {
                const previousLeaf = context[node.name];
                if (isFileLeaf(previousLeaf)) {
                    delete context[node.name];
                    for (const fileName of fileLeafToFileNames(node.name, previousLeaf)) {
                        context[fileName] = null;
                    }
                }
            }
            context[node.name] = context[node.name] ?? {};
            pathStack.push(node.name);
        } else {
            const type = getFileType(node.name);
            const baseName = getBaseName(node.name);
            setFileExtension(context, baseName, type, node.name);
        }
    });

    return { structure, invalidLines };
}
