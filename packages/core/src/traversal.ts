import ignore from 'ignore';
import {
    FolderFileSystemError,
    type EntryMetadata,
    type FolderPath,
    type FolderStructureFileSystem,
} from './filesystem.js';
import {
    fileLeafToFileNames,
    type FolderStructure,
    baseNameFor,
    fileTypeFor,
    isDirectoryNode,
    isFileLeaf,
    mergeFileExtension,
} from './folderStructure.js';

export interface FolderStructureTraversalOptions {
    ignorePatterns: string[];
    respectGitignore: boolean;
    includeHidden?: boolean;
    maxDepth?: number;
}

type TraversalEntryKind = 'directory' | 'file' | 'symlink' | 'unknown';

function hasOwnEntry(structure: FolderStructure, name: string): boolean {
    return Object.prototype.hasOwnProperty.call(structure, name);
}

function setEntry(structure: FolderStructure, name: string, value: FolderStructure[string]): void {
    if (name === '__proto__') {
        // Assignment would invoke the inherited __proto__ setter instead of creating an entry.
        Object.defineProperty(structure, name, {
            configurable: true,
            enumerable: true,
            value,
            writable: true,
        });
        return;
    }

    structure[name] = value;
}

function classifyEntry(metadata: EntryMetadata): TraversalEntryKind {
    if (metadata.kind === 'symlink' || metadata.symlink === 'resolved-as-symlink') {
        return 'symlink';
    }
    if (metadata.symlink !== 'not-a-symlink') {
        return 'unknown';
    }
    if (metadata.kind === 'directory' || metadata.kind === 'file') {
        return metadata.kind;
    }
    return 'unknown';
}

function addFile(structure: FolderStructure, name: string): void {
    const extension = fileTypeFor(name);
    const baseName = baseNameFor(name);
    const existing = hasOwnEntry(structure, baseName) ? structure[baseName] : undefined;
    if (existing !== undefined && isDirectoryNode(existing)) {
        setEntry(structure, name, null);
        return;
    }

    setEntry(
        structure,
        baseName,
        mergeFileExtension(
            existing !== undefined && isFileLeaf(existing) ? existing : undefined,
            extension,
        ),
    );
}

function addDirectory(structure: FolderStructure, name: string, contents: FolderStructure): void {
    const previousValue = hasOwnEntry(structure, name) ? structure[name] : undefined;
    if (previousValue !== undefined && isFileLeaf(previousValue)) {
        delete structure[name];
        for (const fileName of fileLeafToFileNames(name, previousValue)) {
            setEntry(structure, fileName, null);
        }
    }
    setEntry(structure, name, contents);
}

function gitignoreRules(content: string): string[] {
    return content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
}

function validateOptions(options: FolderStructureTraversalOptions): void {
    if (
        options.maxDepth !== undefined &&
        (!Number.isInteger(options.maxDepth) || options.maxDepth < 0)
    ) {
        throw new RangeError('maxDepth must be a non-negative integer.');
    }
}

export async function traverseFolderStructure(
    fileSystem: FolderStructureFileSystem,
    rootPath: FolderPath,
    options: FolderStructureTraversalOptions,
): Promise<FolderStructure> {
    validateOptions(options);

    const rootMetadata = await fileSystem.lstat(rootPath);
    if (classifyEntry(rootMetadata) !== 'directory') {
        throw new FolderFileSystemError(
            'NOT_DIRECTORY',
            'Traversal root must be a known directory and not a symbolic link.',
        );
    }

    const rules = [...options.ignorePatterns];
    if (options.respectGitignore) {
        const gitignorePath = fileSystem.joinChild(rootPath, '.gitignore');
        if (await fileSystem.exists(gitignorePath)) {
            rules.push(...gitignoreRules(await fileSystem.readText(gitignorePath)));
        }
    }
    const matcher = ignore().add(rules);
    const rootName = fileSystem.basename(rootPath);

    const visit = async (directoryPath: FolderPath, depth: number): Promise<FolderStructure> => {
        const structure: FolderStructure = {};
        if (options.maxDepth === depth) {
            return structure;
        }

        const entries = await fileSystem.readDirectory(directoryPath);
        for (const entry of entries) {
            if (!options.includeHidden && entry.name.startsWith('.')) {
                continue;
            }

            const kind = classifyEntry(entry.metadata);
            if (kind === 'unknown') {
                continue;
            }

            const childPath = fileSystem.joinChild(directoryPath, entry.name);
            const relativePath = fileSystem.relative(rootPath, childPath);
            const ignorePath = kind === 'directory' ? `${relativePath}/` : relativePath;
            if (matcher.ignores(ignorePath)) {
                continue;
            }

            if (kind === 'directory') {
                const childStructure =
                    options.maxDepth !== undefined && depth + 1 >= options.maxDepth
                        ? {}
                        : await visit(childPath, depth + 1);
                addDirectory(structure, entry.name, childStructure);
            } else {
                addFile(structure, entry.name);
            }
        }

        return structure;
    };

    return { [rootName]: await visit(rootPath, 0) };
}
