import {
    fileLeafToDisplayNames,
    isDirectoryNode,
    type FileLeaf,
    type FolderStructure,
} from './folderStructure.js';

const TREE_SYMBOLS = {
    VERTICAL: '│',
    BRANCH: '├── ',
    LAST: '└── ',
    INDENT: '    ',
} as const;

export function formatPlainText(structure: FolderStructure): string {
    const formatStructure = (node: FolderStructure, prefix: string, isRoot = false): string => {
        const entries = Object.entries(node);
        return entries
            .map(([name, value], index) => {
                const isLastEntry = index === entries.length - 1;
                if (isDirectoryNode(value)) {
                    const connector = isLastEntry ? TREE_SYMBOLS.LAST : TREE_SYMBOLS.BRANCH;
                    const line = `${isRoot ? '' : prefix}${connector}${name}/`;
                    const childPrefix = isRoot
                        ? TREE_SYMBOLS.INDENT
                        : prefix +
                          (isLastEntry
                              ? TREE_SYMBOLS.INDENT
                              : `${TREE_SYMBOLS.VERTICAL}${TREE_SYMBOLS.INDENT.slice(1)}`);
                    const nested = formatStructure(value, childPrefix);
                    const trailingNewline = isRoot && !isLastEntry ? '\n' : '';
                    return nested
                        ? `${line}\n${nested}${trailingNewline}`
                        : `${line}${trailingNewline}`;
                }
                const displayNames = fileLeafToDisplayNames(name, value as FileLeaf);
                return displayNames
                    .map((displayName, displayIndex) => {
                        const isLastLine = isLastEntry && displayIndex === displayNames.length - 1;
                        const connector = isLastLine ? TREE_SYMBOLS.LAST : TREE_SYMBOLS.BRANCH;
                        return `${isRoot ? '' : prefix}${connector}${displayName}`;
                    })
                    .join('\n');
            })
            .join('\n');
    };

    return `Directory structure:\n${formatStructure(structure, '', true)}`;
}

export function formatJson(structure: FolderStructure): string {
    return JSON.stringify(structure, null, 2);
}
