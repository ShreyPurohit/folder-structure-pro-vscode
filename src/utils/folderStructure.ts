import { FileLeaf, FolderStructure } from '../types';

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
