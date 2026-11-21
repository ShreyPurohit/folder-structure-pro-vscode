export type FileLeaf = string | string[] | null;

export interface FolderStructure {
    [key: string]: FolderStructure | FileLeaf;
}

export interface TreeNode {
    name: string;
    level: number;
    isDirectory: boolean;
}

function extensionOf(name: string): string {
    const baseName = name.slice(name.lastIndexOf('/') + 1);
    if (baseName === '.' || baseName === '..') {
        return '';
    }
    const dot = baseName.lastIndexOf('.');
    return dot <= 0 ? '' : baseName.slice(dot);
}

export function fileTypeFor(name: string): string {
    return extensionOf(name).replace(/^\./, '') || 'file';
}

export function baseNameFor(name: string): string {
    const extension = extensionOf(name);
    return extension ? name.slice(0, -extension.length) : name;
}

export function isDirectoryNode(value: FolderStructure[string]): value is FolderStructure {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isFileLeaf(value: FolderStructure[string]): value is FileLeaf {
    return typeof value === 'string' || Array.isArray(value) || value === null;
}

export function mergeFileExtension(existing: FileLeaf | undefined, extension: string): FileLeaf {
    if (existing === undefined) {
        return extension;
    }
    if (existing === null) {
        return extension === 'file' ? null : ['file', extension];
    }
    if (Array.isArray(existing)) {
        return existing.includes(extension) ? existing : [...existing, extension];
    }
    return existing === extension ? existing : [existing, extension];
}

export function fileLeafToDisplayNames(baseName: string, leaf: FileLeaf): string[] {
    const types = Array.isArray(leaf) ? leaf : [leaf];
    return types.map((type) =>
        type === null || type === 'file' || type.trim() === '' ? baseName : `${baseName}.${type}`,
    );
}

export function fileLeafToFileNames(baseName: string, leaf: FileLeaf): string[] {
    return fileLeafToDisplayNames(baseName, leaf);
}

export function normalizeFileLeafExtensions(leaf: FileLeaf): string[] {
    const values = Array.isArray(leaf) ? leaf : [leaf];
    return values.map((value) =>
        value === null || value === 'file' || value.trim() === '' ? 'file' : value,
    );
}
