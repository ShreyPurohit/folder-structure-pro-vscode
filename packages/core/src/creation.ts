import {
    FolderFileSystemError,
    type EntryMetadata,
    type ExclusiveFileCreation,
    type FolderPath,
    type FolderStructureFileSystem,
} from './filesystem.js';
import {
    fileLeafToFileNames,
    isDirectoryNode,
    isFileLeaf,
    type FolderStructure,
} from './folderStructure.js';
import { validateJsonStructure } from './json.js';

export type PlannedCreationKind = 'directory' | 'file';
export type PlannedCreationStatus = 'missing' | 'existing-directory' | 'existing-file';
export type CreationConflictResolution = 'replace' | 'skip' | 'cancel';

export interface PlannedCreationEntry {
    path: FolderPath;
    relativePath: string;
    kind: PlannedCreationKind;
    status: PlannedCreationStatus;
    parentDirectories: readonly FolderPath[];
}

export interface StructureCreationPlan {
    destination: FolderPath;
    entries: readonly PlannedCreationEntry[];
    conflicts: readonly PlannedCreationEntry[];
}

export interface StructureCreationResult {
    cancelled: boolean;
    directoriesCreated: number;
    directoriesReused: number;
    filesCreated: number;
    filesReplaced: number;
    filesSkipped: number;
}

export class StructureCreationValidationError extends Error {
    constructor(readonly issues: readonly string[]) {
        super(issues.join('\n'));
        this.name = 'StructureCreationValidationError';
    }
}

function creationCount(count: number, singular: string): string {
    const plural = singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`;
    return `${count} ${count === 1 ? singular : plural}`;
}

export class StructureCreationExecutionError extends Error {
    constructor(
        readonly relativePath: string,
        readonly completed: StructureCreationResult,
        cause: unknown,
    ) {
        super(
            `Creation stopped at "${relativePath}". Completed before failure: ${creationCount(completed.directoriesCreated, 'directory')} created, ${creationCount(completed.directoriesReused, 'directory')} reused, ${creationCount(completed.filesCreated, 'file')} created, ${creationCount(completed.filesReplaced, 'file')} replaced, and ${creationCount(completed.filesSkipped, 'file')} skipped. The failed operation may have partially affected "${relativePath}"; no rollback was attempted.`,
            { cause },
        );
        this.name = 'StructureCreationExecutionError';
    }
}

interface DesiredCreationEntry {
    path: FolderPath;
    relativePath: string;
    kind: PlannedCreationKind;
    parentDirectories: readonly FolderPath[];
    segments: readonly string[];
}

const WINDOWS_RESERVED_NAME =
    /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i;
const WINDOWS_INVALID_CHARACTERS = /[<>:"|?*]/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isPortablePathComponent(name: string): boolean {
    return (
        name.length > 0 &&
        name !== '.' &&
        name !== '..' &&
        !name.includes('/') &&
        !name.includes('\\') &&
        !CONTROL_CHARACTERS.test(name) &&
        !WINDOWS_INVALID_CHARACTERS.test(name) &&
        !/[. ]$/.test(name) &&
        !WINDOWS_RESERVED_NAME.test(name)
    );
}

function pathKey(segments: readonly string[]): string {
    return segments.map((segment) => segment.toLowerCase()).join('\0');
}

function isKnownKind(metadata: EntryMetadata, kind: PlannedCreationKind): boolean {
    return metadata.symlink === 'not-a-symlink' && metadata.kind === kind;
}

async function metadataIfPresent(
    fileSystem: FolderStructureFileSystem,
    path: FolderPath,
): Promise<EntryMetadata | undefined> {
    try {
        return await fileSystem.lstat(path);
    } catch (error) {
        if (error instanceof FolderFileSystemError && error.code === 'NOT_FOUND') {
            return undefined;
        }
        throw error;
    }
}

function entryStatus(
    entry: Pick<DesiredCreationEntry, 'kind'>,
    metadata: EntryMetadata | undefined,
): PlannedCreationStatus | undefined {
    if (!metadata) {
        return 'missing';
    }
    if (
        metadata.kind === 'symlink' ||
        metadata.kind === 'unknown' ||
        metadata.symlink !== 'not-a-symlink'
    ) {
        return undefined;
    }
    if (entry.kind === 'directory' && metadata.kind === 'directory') {
        return 'existing-directory';
    }
    if (entry.kind === 'file' && metadata.kind === 'file') {
        return 'existing-file';
    }
    return undefined;
}

function pathIssue(entry: DesiredCreationEntry, metadata?: EntryMetadata): string {
    if (
        metadata &&
        (metadata.kind === 'symlink' ||
            metadata.kind === 'unknown' ||
            metadata.symlink !== 'not-a-symlink')
    ) {
        return `"${entry.relativePath}" is a symbolic link or has unknown filesystem metadata.`;
    }
    return `"${entry.relativePath}" exists as a ${metadata?.kind ?? 'unknown entry'}, but the structure requires a ${entry.kind}.`;
}

export async function planStructureCreation(
    fileSystem: FolderStructureFileSystem,
    destination: FolderPath,
    input: unknown,
): Promise<StructureCreationPlan> {
    if (!validateJsonStructure(input)) {
        throw new StructureCreationValidationError([
            'The structure must contain nested directories and string, string-array, or null file entries.',
        ]);
    }
    if (Object.keys(input).length === 0) {
        throw new StructureCreationValidationError(['The structure is empty.']);
    }

    const rootMetadata = await fileSystem.lstat(destination);
    if (!isKnownKind(rootMetadata, 'directory')) {
        throw new StructureCreationValidationError([
            'The destination must be a known directory and must not be a symbolic link.',
        ]);
    }

    const desiredEntries: DesiredCreationEntry[] = [];
    const pathEntries = new Map<string, DesiredCreationEntry>();
    const issues: string[] = [];

    const addEntry = (
        segments: readonly string[],
        name: string,
        kind: PlannedCreationKind,
        parentDirectories: readonly FolderPath[],
    ): FolderPath | undefined => {
        if (!isPortablePathComponent(name)) {
            issues.push(`"${name}" is not a safe, portable filesystem name.`);
            return undefined;
        }

        const key = pathKey(segments);
        const previous = pathEntries.get(key);
        if (previous) {
            issues.push(
                previous.kind === kind
                    ? `Duplicate path "${segments.join('/')}".`
                    : `Path "${segments.join('/')}" is both a file and a directory.`,
            );
            return undefined;
        }

        for (let length = 1; length < segments.length; length++) {
            const ancestor = pathEntries.get(pathKey(segments.slice(0, length)));
            if (ancestor?.kind === 'file') {
                issues.push(
                    `Path "${ancestor.relativePath}" is a file and cannot contain "${segments.join('/')}".`,
                );
                return undefined;
            }
        }

        let entryPath: FolderPath;
        try {
            entryPath = fileSystem.joinChild(parentDirectories[parentDirectories.length - 1], name);
        } catch (error) {
            issues.push(
                error instanceof Error
                    ? `"${name}" is not a valid child path: ${error.message}`
                    : `"${name}" is not a valid child path.`,
            );
            return undefined;
        }

        const relativePath = fileSystem.relative(destination, entryPath);
        const entry: DesiredCreationEntry = {
            path: entryPath,
            relativePath,
            kind,
            parentDirectories,
            segments,
        };
        pathEntries.set(key, entry);
        desiredEntries.push(entry);
        return entryPath;
    };

    const visit = (
        structure: FolderStructure,
        parentDirectories: readonly FolderPath[],
        parentSegments: readonly string[],
    ): void => {
        for (const [name, value] of Object.entries(structure)) {
            if (isDirectoryNode(value)) {
                const segments = [...parentSegments, name];
                const directoryPath = addEntry(segments, name, 'directory', parentDirectories);
                if (directoryPath) {
                    visit(value, [...parentDirectories, directoryPath], segments);
                }
                continue;
            }

            if (!isFileLeaf(value)) {
                issues.push(`"${name}" has an invalid structure value.`);
                continue;
            }

            if (!isPortablePathComponent(name)) {
                issues.push(`"${name}" is not a safe, portable filesystem name.`);
                continue;
            }
            for (const fileName of fileLeafToFileNames(name, value)) {
                addEntry([...parentSegments, fileName], fileName, 'file', parentDirectories);
            }
        }
    };

    visit(input, [destination], []);
    if (issues.length > 0) {
        throw new StructureCreationValidationError(issues);
    }

    const entries: PlannedCreationEntry[] = [];
    for (const entry of desiredEntries) {
        const metadata = await metadataIfPresent(fileSystem, entry.path);
        const status = entryStatus(entry, metadata);
        if (!status) {
            issues.push(pathIssue(entry, metadata));
            continue;
        }
        entries.push({
            path: entry.path,
            relativePath: entry.relativePath,
            kind: entry.kind,
            status,
            parentDirectories: entry.parentDirectories,
        });
    }

    if (issues.length > 0) {
        throw new StructureCreationValidationError(issues);
    }

    return {
        destination,
        entries,
        conflicts: entries.filter((entry) => entry.status === 'existing-file'),
    };
}

function emptyResult(): StructureCreationResult {
    return {
        cancelled: false,
        directoriesCreated: 0,
        directoriesReused: 0,
        filesCreated: 0,
        filesReplaced: 0,
        filesSkipped: 0,
    };
}

async function assertPlanEntryUnchanged(
    fileSystem: FolderStructureFileSystem,
    entry: PlannedCreationEntry,
): Promise<void> {
    const metadata = await metadataIfPresent(fileSystem, entry.path);
    const actualStatus = entryStatus(entry, metadata);
    if (actualStatus !== entry.status) {
        throw new StructureCreationValidationError([
            `The destination changed after planning at "${entry.relativePath}". Review the destination and try again.`,
        ]);
    }
}

async function assertKnownDirectory(
    fileSystem: FolderStructureFileSystem,
    path: FolderPath,
): Promise<void> {
    const metadata = await fileSystem.lstat(path);
    if (!isKnownKind(metadata, 'directory')) {
        throw new StructureCreationValidationError([
            'A destination directory became a symbolic link, an unknown entry, or a non-directory.',
        ]);
    }
}

export async function executeStructureCreation(
    fileSystem: FolderStructureFileSystem & ExclusiveFileCreation,
    plan: StructureCreationPlan,
    conflictResolution: CreationConflictResolution,
): Promise<StructureCreationResult> {
    const result = emptyResult();
    if (conflictResolution === 'cancel') {
        return { ...result, cancelled: true };
    }

    await assertKnownDirectory(fileSystem, plan.destination);
    for (const entry of plan.entries) {
        await assertPlanEntryUnchanged(fileSystem, entry);
    }

    const directories = plan.entries.filter((entry) => entry.kind === 'directory');
    const files = plan.entries.filter((entry) => entry.kind === 'file');
    for (const entry of [...directories, ...files]) {
        try {
            for (const parent of entry.parentDirectories) {
                await assertKnownDirectory(fileSystem, parent);
            }
            await assertPlanEntryUnchanged(fileSystem, entry);

            if (entry.kind === 'directory') {
                if (entry.status === 'existing-directory') {
                    result.directoriesReused++;
                } else {
                    await fileSystem.createDirectory(entry.path);
                    await assertKnownDirectory(fileSystem, entry.path);
                    result.directoriesCreated++;
                }
                continue;
            }

            if (entry.status === 'existing-file') {
                if (conflictResolution === 'skip') {
                    result.filesSkipped++;
                } else {
                    await fileSystem.writeText(entry.path, '');
                    result.filesReplaced++;
                }
            } else {
                await fileSystem.createFileExclusive(entry.path, '');
                result.filesCreated++;
            }
        } catch (cause) {
            throw new StructureCreationExecutionError(entry.relativePath, { ...result }, cause);
        }
    }

    return result;
}
