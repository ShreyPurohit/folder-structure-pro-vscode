import {
    FolderFileSystemError,
    executeStructureCreation,
    formatJson,
    formatPlainText,
    parseJsonWithComments,
    parsePlainTextToStructure,
    planStructureCreation,
    StructureCreationExecutionError,
    traverseFolderStructure,
    type FolderStructure,
    type PlannedCreationEntry,
} from '@folder-structure-pro/core';
import * as path from 'node:path';
import {
    CliArgumentError,
    formatCliHelp,
    parseCliArguments,
    type ParsedCliArguments,
    type ScanCommandOptions,
} from './arguments.js';
import { systemClipboard, type ClipboardAdapter } from './adapters/clipboard.js';
import { exportStructure } from './adapters/nodeOutput.js';
import { NodeFileSystemAdapter } from './adapters/nodeFileSystem.js';
import { CANCELLED, createCliPrompts, type CliPrompts, type PromptResult } from './presentation.js';

export type CliWriter = (text: string) => void | Promise<void>;

export interface CliDependencies {
    fileSystem: NodeFileSystemAdapter;
    clipboard: ClipboardAdapter;
    prompts: CliPrompts;
    cwd: string;
}

export type ExecutableDependencies = Omit<CliDependencies, 'prompts'> &
    Partial<Pick<CliDependencies, 'prompts'>>;

export interface RunExecutableOptions {
    stdinIsTTY?: boolean;
    stdoutIsTTY?: boolean;
    argv?: readonly string[];
    stdout?: CliWriter;
    stderr?: CliWriter;
    dependencies?: ExecutableDependencies;
}

function isCancelled<T>(value: PromptResult<T>): value is typeof CANCELLED {
    return value === CANCELLED;
}

function parsePatterns(value: string): string[] {
    return value
        .split(',')
        .map((pattern) => pattern.trim())
        .filter(Boolean);
}

function summarizeStructure(structure: FolderStructure): { entries: number; directories: number } {
    let entries = 0;
    let directories = 0;

    const visit = (node: FolderStructure): void => {
        for (const value of Object.values(node)) {
            entries++;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                directories++;
                visit(value);
            }
        }
    };

    for (const value of Object.values(structure)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            visit(value);
        }
    }
    return { entries, directories };
}

async function resolveScanRoot(
    fileSystem: NodeFileSystemAdapter,
    cwd: string,
    requestedDirectory: string,
): Promise<ReturnType<NodeFileSystemAdapter['toFolderPath']>> {
    const rootPath = fileSystem.toFolderPath(path.resolve(cwd, requestedDirectory.trim() || cwd));
    const rootMetadata = await fileSystem.lstat(rootPath);
    if (rootMetadata.kind !== 'directory' || rootMetadata.symlink !== 'not-a-symlink') {
        throw new FolderFileSystemError(
            'NOT_DIRECTORY',
            'Choose an existing directory that is not a symbolic link.',
        );
    }
    return rootPath;
}

async function generateStructure(
    fileSystem: NodeFileSystemAdapter,
    rootPath: ReturnType<NodeFileSystemAdapter['toFolderPath']>,
    options: Omit<ScanCommandOptions, 'directory'>,
): Promise<{ content: string; entries: number; directories: number }> {
    const structure = await traverseFolderStructure(fileSystem, rootPath, {
        ignorePatterns: ['node_modules', ...options.ignorePatterns],
        respectGitignore: options.respectGitignore,
        includeHidden: options.includeHidden,
        maxDepth: options.maxDepth,
    });
    const content = options.format === 'text' ? formatPlainText(structure) : formatJson(structure);
    const summary = summarizeStructure(structure);
    return { content, ...summary };
}

export function createBoundedPreview(content: string, maxLines = 12, maxCharacters = 1200): string {
    if (maxLines < 1 || maxCharacters < 1) {
        throw new RangeError('Preview limits must be positive.');
    }

    const lines: string[] = [];
    let characters = 0;
    let truncated = false;
    for (const line of content.split('\n')) {
        if (lines.length >= maxLines || characters + line.length > maxCharacters) {
            truncated = true;
            break;
        }
        lines.push(line);
        characters += line.length + 1;
    }

    if (truncated) {
        lines.push('… preview truncated');
    }
    return lines.join('\n');
}

function formatCreationPreview(entries: readonly PlannedCreationEntry[]): string {
    return entries
        .map((entry) => {
            const action =
                entry.status === 'missing'
                    ? 'create'
                    : entry.status === 'existing-directory'
                      ? 'reuse'
                      : 'conflict';
            const suffix = entry.kind === 'directory' ? '/' : '';
            return `[${action}] ${entry.relativePath}${suffix}`;
        })
        .join('\n');
}

function creationSummary(entries: readonly PlannedCreationEntry[], conflictCount: number): string {
    const directories = entries.filter((entry) => entry.kind === 'directory');
    const files = entries.filter((entry) => entry.kind === 'file');
    return `${directories.filter((entry) => entry.status === 'missing').length} directories to create, ${directories.filter((entry) => entry.status === 'existing-directory').length} directories to reuse, ${files.filter((entry) => entry.status === 'missing').length} files to create, ${conflictCount} existing file conflicts`;
}

function countLabel(count: number, singular: string): string {
    const plural = singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`;
    return `${count} ${count === 1 ? singular : plural}`;
}

function formatExecutionError(error: StructureCreationExecutionError): string {
    const cause =
        error.cause instanceof FolderFileSystemError
            ? `${error.cause.message} (${error.cause.code})`
            : error.cause instanceof Error
              ? error.cause.message
              : 'Filesystem operation failed.';
    return `${error.message}\nCause: ${cause}`;
}

async function readStructureFile(
    fileSystem: NodeFileSystemAdapter,
    cwd: string,
    requestedPath: string,
    format: 'text' | 'json',
): Promise<unknown> {
    const structureFilePath = fileSystem.toFolderPath(path.resolve(cwd, requestedPath.trim()));
    const structureFileMetadata = await fileSystem.lstat(structureFilePath);
    if (
        structureFileMetadata.kind !== 'file' ||
        structureFileMetadata.symlink !== 'not-a-symlink'
    ) {
        throw new FolderFileSystemError(
            'INVALID_PATH',
            'The structure input must be a regular, non-symbolic-link file.',
        );
    }

    const content = await fileSystem.readText(structureFilePath);
    if (format === 'text') {
        const parsed = parsePlainTextToStructure(content);
        if (parsed.invalidLines.length > 0) {
            throw new Error(
                `Invalid plain-text structure lines: ${parsed.invalidLines.join(', ')}. No files or directories were created.`,
            );
        }
        return parsed.structure;
    }
    return parseJsonWithComments(content);
}

function formatCommandError(error: unknown): string {
    if (error instanceof StructureCreationExecutionError) {
        return formatExecutionError(error);
    }
    if (error instanceof FolderFileSystemError) {
        return `${error.message} (${error.code})`;
    }
    return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function formatCreationResult(
    result: Awaited<ReturnType<typeof executeStructureCreation>>,
): string {
    return `Created ${countLabel(result.directoriesCreated, 'directory')} and ${countLabel(result.filesCreated, 'file')}; reused ${countLabel(result.directoriesReused, 'directory')}, replaced ${countLabel(result.filesReplaced, 'file')}, and skipped ${countLabel(result.filesSkipped, 'file')}.`;
}

async function runDirectCommand(
    command: Exclude<ParsedCliArguments, { kind: 'interactive' } | { kind: 'help' }>,
    dependencies: ExecutableDependencies,
    stdout: CliWriter,
    stderr: CliWriter,
): Promise<number> {
    const { fileSystem, clipboard, cwd } = dependencies;
    try {
        if (command.kind === 'copy' || command.kind === 'export') {
            const rootPath = await resolveScanRoot(fileSystem, cwd, command.options.directory);
            const generated = await generateStructure(fileSystem, rootPath, command.options);
            if (command.kind === 'copy') {
                await clipboard.write(generated.content);
                await stderr(
                    `Copied ${countLabel(generated.entries, 'entry')} to the clipboard.\n`,
                );
                return 0;
            }

            if (command.output === '-') {
                await stdout(`${generated.content}\n`);
                return 0;
            }
            const result = await exportStructure(
                fileSystem,
                command.output,
                cwd,
                generated.content,
                async (filePath) => {
                    if (command.force) {
                        return true;
                    }
                    throw new FolderFileSystemError(
                        'ALREADY_EXISTS',
                        `Output file already exists: ${filePath}. Use --force to replace it.`,
                    );
                },
            );
            await stderr(`Exported ${countLabel(generated.entries, 'entry')} to ${result}.\n`);
            return 0;
        }

        const structure = await readStructureFile(
            fileSystem,
            cwd,
            command.structureFile,
            command.format,
        );
        const destination = fileSystem.toFolderPath(path.resolve(cwd, command.destination));
        const plan = await planStructureCreation(fileSystem, destination, structure);
        if (command.onConflict === 'fail' && plan.conflicts.length > 0) {
            throw new FolderFileSystemError(
                'ALREADY_EXISTS',
                `${plan.conflicts.length} existing file conflict(s) found. No changes were made; use --on-conflict skip or --on-conflict replace.`,
            );
        }
        const result = await executeStructureCreation(
            fileSystem,
            plan,
            command.onConflict === 'replace' ? 'replace' : 'skip',
        );
        await stderr(`${formatCreationResult(result)}\n`);
        return 0;
    } catch (error) {
        await stderr(`${formatCommandError(error)}\n`);
        return 1;
    }
}

export async function runCli(dependencies: CliDependencies): Promise<number> {
    const { fileSystem, clipboard, prompts, cwd } = dependencies;
    try {
        prompts.intro('Folder Structure Pro');
        const operation = await prompts.chooseOperation();
        if (isCancelled(operation)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }
        if (operation === 'create') {
            return await runStructureCreation(dependencies);
        }

        const requestedTarget = await prompts.chooseTarget(cwd);
        if (isCancelled(requestedTarget)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }

        const rootPath = await resolveScanRoot(fileSystem, cwd, requestedTarget);

        const format = await prompts.chooseFormat();
        if (isCancelled(format)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }

        const filters = await prompts.chooseFilters();
        if (isCancelled(filters)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }

        const rawPatterns = await prompts.enterIgnorePatterns();
        if (isCancelled(rawPatterns)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }

        const rawDepth = await prompts.enterMaxDepth();
        if (isCancelled(rawDepth)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }

        const normalizedDepth = rawDepth.trim();
        if (normalizedDepth !== '' && !/^\d+$/.test(normalizedDepth)) {
            throw new RangeError('Maximum depth must be a non-negative whole number.');
        }
        const maxDepth = normalizedDepth === '' ? undefined : Number.parseInt(normalizedDepth, 10);
        if (maxDepth !== undefined && (!Number.isSafeInteger(maxDepth) || maxDepth < 0)) {
            throw new RangeError('Maximum depth must be a non-negative whole number.');
        }

        const generated = await generateStructure(fileSystem, rootPath, {
            format,
            ignorePatterns: parsePatterns(rawPatterns),
            respectGitignore: filters.respectGitignore,
            includeHidden: filters.includeHidden,
            maxDepth,
        });
        const summaryText = `${generated.entries} entries (${generated.directories} directories); ${generated.content.length} characters`;
        prompts.showPreview(createBoundedPreview(generated.content), summaryText);

        const destination = await prompts.chooseDestination();
        if (isCancelled(destination)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }

        if (destination === 'clipboard') {
            await clipboard.write(generated.content);
            prompts.outro(
                `Copied ${generated.entries} ${generated.entries === 1 ? 'entry' : 'entries'} to the clipboard.`,
            );
            return 0;
        }

        const requestedOutput = await prompts.enterOutputPath(
            path.join(cwd, `folder-structure.${format === 'text' ? 'txt' : 'json'}`),
        );
        if (isCancelled(requestedOutput)) {
            prompts.cancel('Operation cancelled.');
            return 0;
        }

        const result = await exportStructure(
            fileSystem,
            requestedOutput.trim(),
            cwd,
            generated.content,
            async (filePath) => {
                const confirmation = await prompts.confirmOverwrite(filePath);
                if (isCancelled(confirmation)) {
                    return false;
                }
                return confirmation;
            },
        );

        if (result === 'cancelled') {
            prompts.cancel('Export cancelled; the existing file was not changed.');
            return 0;
        }

        prompts.outro(
            `Exported ${generated.entries} ${generated.entries === 1 ? 'entry' : 'entries'} to ${result}.`,
        );
        return 0;
    } catch (error) {
        const detail =
            error instanceof StructureCreationExecutionError
                ? formatExecutionError(error)
                : error instanceof FolderFileSystemError
                  ? `${error.message} (${error.code})`
                  : error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred.';
        prompts.error(detail);
        return 1;
    }
}

async function runStructureCreation(dependencies: CliDependencies): Promise<number> {
    const { fileSystem, prompts, cwd } = dependencies;
    const format = await prompts.chooseStructureFormat();
    if (isCancelled(format)) {
        prompts.cancel('Operation cancelled.');
        return 0;
    }

    const structurePathResult = await prompts.enterStructurePath(
        path.join(cwd, `folder-structure.${format === 'text' ? 'txt' : 'json'}`),
    );
    if (isCancelled(structurePathResult)) {
        prompts.cancel('Operation cancelled.');
        return 0;
    }

    const structure = await readStructureFile(fileSystem, cwd, structurePathResult, format);

    const destinationResult = await prompts.enterDestinationDirectory(cwd);
    if (isCancelled(destinationResult)) {
        prompts.cancel('Operation cancelled.');
        return 0;
    }
    const destination = fileSystem.toFolderPath(path.resolve(cwd, destinationResult.trim() || cwd));
    const plan = await planStructureCreation(fileSystem, destination, structure);
    const summary = creationSummary(plan.entries, plan.conflicts.length);
    prompts.showPreview(createBoundedPreview(formatCreationPreview(plan.entries)), summary);

    let conflictResolution: 'replace' | 'skip' | 'cancel' = 'skip';
    if (plan.conflicts.length > 0) {
        const choice = await prompts.chooseFileConflictResolution(plan.conflicts.length);
        if (isCancelled(choice) || choice === 'cancel') {
            prompts.cancel('Structure creation cancelled; no changes were made.');
            return 0;
        }
        conflictResolution = choice;
    }

    const confirmation = await prompts.confirmStructureCreation(
        conflictResolution === 'replace' && plan.conflicts.length > 0
            ? `${summary}. ${plan.conflicts.length} existing regular file(s) will be emptied.`
            : summary,
    );
    if (isCancelled(confirmation) || !confirmation) {
        prompts.cancel('Structure creation cancelled; no changes were made.');
        return 0;
    }

    const result = await executeStructureCreation(fileSystem, plan, conflictResolution);
    prompts.outro(formatCreationResult(result));
    return 0;
}

export async function runExecutable(options: RunExecutableOptions = {}): Promise<number> {
    const argv = options.argv ?? process.argv.slice(2);
    const stdout = options.stdout ?? ((text: string) => void process.stdout.write(text));
    const stderr = options.stderr ?? ((text: string) => void process.stderr.write(text));
    let command: ParsedCliArguments;
    try {
        command = parseCliArguments(argv);
    } catch (error) {
        await stderr(
            `${error instanceof CliArgumentError ? error.message : formatCommandError(error)}\nUse --help to see available commands and options.\n`,
        );
        return 2;
    }

    if (command.kind === 'help') {
        await stdout(formatCliHelp(command.command));
        return 0;
    }

    const dependencies: ExecutableDependencies =
        options.dependencies ??
        ({
            fileSystem: new NodeFileSystemAdapter(),
            clipboard: systemClipboard,
            cwd: process.cwd(),
        } satisfies ExecutableDependencies);

    if (command.kind !== 'interactive') {
        return runDirectCommand(command, dependencies, stdout, stderr);
    }

    const stdinIsTTY = options.stdinIsTTY ?? process.stdin.isTTY === true;
    const stdoutIsTTY = options.stdoutIsTTY ?? process.stdout.isTTY === true;
    if (!stdinIsTTY || !stdoutIsTTY) {
        await stderr(
            'No command was provided and interactive mode requires a TTY. Use --help to see available commands.\n',
        );
        return 2;
    }

    return runCli({
        ...dependencies,
        prompts: dependencies.prompts ?? createCliPrompts(),
    });
}
