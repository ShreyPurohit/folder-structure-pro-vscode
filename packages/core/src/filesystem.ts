declare const folderPathBrand: unique symbol;

export type FolderPath = string & {
    readonly [folderPathBrand]: true;
};

export type EntryKind = 'file' | 'directory' | 'symlink' | 'unknown';

export type SymlinkStatus = 'resolved-as-symlink' | 'not-a-symlink' | 'unknown';

export interface EntryMetadata {
    /**
     * The entry itself, not the target of a symbolic link. If a provider
     * cannot distinguish a link from its target, it must report `unknown`
     * for both `kind` and `symlink`.
     */
    kind: EntryKind;

    /**
     * `resolved-as-symlink` means the provider identified the entry itself as
     * a symbolic link; it does not mean the target was resolved. Use
     * `not-a-symlink` only when known, and `unknown` when link metadata is
     * unavailable or ambiguous.
     */
    symlink: SymlinkStatus;
}

export interface DirectoryEntry {
    name: string;
    metadata: EntryMetadata;
}

export type FolderFileSystemErrorCode =
    | 'NOT_FOUND'
    | 'NOT_DIRECTORY'
    | 'PERMISSION_DENIED'
    | 'ALREADY_EXISTS'
    | 'INVALID_PATH'
    | 'IO_ERROR';

export class FolderFileSystemError extends Error {
    constructor(
        readonly code: FolderFileSystemErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'FolderFileSystemError';
    }
}

export interface FolderStructureFileSystem {
    readDirectory(path: FolderPath): Promise<DirectoryEntry[]>;
    readText(path: FolderPath): Promise<string>;

    /**
     * Requests link-aware metadata without following links where the provider
     * supports it. Providers that cannot distinguish links must report unknown.
     */
    lstat(path: FolderPath): Promise<EntryMetadata>;

    /**
     * Returns false only when lstat reports NOT_FOUND. Other failures propagate.
     */
    exists(path: FolderPath): Promise<boolean>;

    /**
     * Creates this directory and missing parents; an existing directory is
     * accepted. This operation does not guarantee symlink prevention.
     */
    createDirectory(path: FolderPath): Promise<void>;

    /**
     * Writes text, replacing an existing file according to provider semantics.
     * This is not an exclusive-create operation.
     */
    writeText(path: FolderPath, content: string): Promise<void>;

    /**
     * Joins exactly one child component to a parent path. Rejects empty,
     * rooted, dot, dot-dot, NUL-containing, and otherwise invalid components,
     * including separators for the adapter's path model. Must not silently
     * normalize, split, or reinterpret an invalid name.
     */
    joinChild(parent: FolderPath, name: string): FolderPath;

    /**
     * Returns a normalized relative path using forward slashes.
     */
    relative(base: FolderPath, path: FolderPath): string;

    basename(path: FolderPath): string;
}

/**
 * Optional capability for adapters that can guarantee atomic exclusive
 * creation. It is intentionally not required by FolderStructureFileSystem.
 */
export interface ExclusiveFileCreation {
    createFileExclusive(path: FolderPath, content: string): Promise<void>;
}
