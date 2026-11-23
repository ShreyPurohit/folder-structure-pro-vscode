import { statSync } from 'node:fs';
import {
    cancel,
    confirm,
    intro,
    isCancel,
    log,
    multiselect,
    outro,
    path as selectPath,
    select,
    spinner,
    text,
} from '@clack/prompts';

export const CANCELLED = { kind: 'cancelled' } as const;
export type Cancelled = typeof CANCELLED;
export type PromptResult<T> = T | Cancelled;
export type CliOperation = 'copy' | 'create';
export type StructureInputFormat = 'text' | 'json';
export type CopyFallbackChoice = 'print' | 'file' | 'cancel';
export type FileConflictChoice = 'replace' | 'skip' | 'cancel';

export interface CliFilters {
    includeHidden: boolean;
    respectGitignore: boolean;
}

export interface CliPrompts {
    intro(message: string): void;
    chooseOperation(): Promise<PromptResult<CliOperation>>;
    chooseTarget(initialValue: string): Promise<PromptResult<string>>;
    chooseFormat(): Promise<PromptResult<'text' | 'json'>>;
    chooseFilters(): Promise<PromptResult<CliFilters>>;
    enterIgnorePatterns(): Promise<PromptResult<string>>;
    enterMaxDepth(): Promise<PromptResult<string>>;
    chooseDestination(): Promise<PromptResult<'clipboard' | 'file'>>;
    enterOutputPath(initialValue: string): Promise<PromptResult<string>>;
    confirmOverwrite(filePath: string): Promise<PromptResult<boolean>>;
    chooseCopyFallback(): Promise<PromptResult<CopyFallbackChoice>>;
    /** Writes the content unadorned (no prompt gutter) so it can be selected and copied from the terminal. */
    printContent(content: string): void;
    chooseStructureFormat(): Promise<PromptResult<StructureInputFormat>>;
    enterStructurePath(initialValue: string): Promise<PromptResult<string>>;
    enterDestinationDirectory(initialValue: string): Promise<PromptResult<string>>;
    chooseFileConflictResolution(
        existingFileCount: number,
    ): Promise<PromptResult<FileConflictChoice>>;
    confirmStructureCreation(summary: string): Promise<PromptResult<boolean>>;
    showPreview(preview: string, summary: string): void;
    /** Shows a spinner while a slow task runs, then replaces it with the done message. */
    withSpinner<T>(message: string, doneMessage: string, task: () => Promise<T>): Promise<T>;
    warn(message: string): void;
    error(message: string): void;
    cancel(message: string): void;
    outro(message: string): void;
}

function isExistingFile(filePath: string): boolean {
    try {
        return statSync(filePath).isFile();
    } catch {
        return false;
    }
}

export function createCliPrompts(): CliPrompts {
    return {
        intro,
        async chooseOperation() {
            const result = await select({
                message: 'What would you like to do?',
                options: [
                    { value: 'copy', label: 'Copy or export a folder structure' },
                    { value: 'create', label: 'Create directories and empty files' },
                ],
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async chooseTarget(initialValue) {
            const result = await selectPath({
                message: 'Directory to scan',
                initialValue,
                directory: true,
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async chooseFormat() {
            const result = await select({
                message: 'Output format',
                options: [
                    { value: 'text', label: 'Plain text' },
                    { value: 'json', label: 'JSON' },
                ],
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async chooseFilters() {
            const result = await multiselect({
                message: 'Filtering options',
                options: [
                    { value: 'hidden', label: 'Include hidden files and directories' },
                    { value: 'gitignore', label: 'Do not respect root .gitignore' },
                ],
                initialValues: [],
                required: false,
            });
            if (isCancel(result)) {
                return CANCELLED;
            }
            return {
                includeHidden: result.includes('hidden'),
                respectGitignore: !result.includes('gitignore'),
            };
        },
        async enterIgnorePatterns() {
            const result = await text({
                message: 'Additional ignore patterns (comma-separated, optional)',
                placeholder: 'e.g. dist, coverage',
                defaultValue: '',
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async enterMaxDepth() {
            const result = await text({
                message: 'Maximum depth (blank for unlimited)',
                placeholder: 'Unlimited',
                defaultValue: '',
                validate(value) {
                    if (
                        value !== undefined &&
                        value !== '' &&
                        (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
                    ) {
                        return 'Enter a non-negative whole number, or leave blank for unlimited.';
                    }
                },
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async chooseDestination() {
            const result = await select({
                message: 'Where should the structure go?',
                options: [
                    { value: 'clipboard', label: 'Copy to clipboard' },
                    { value: 'file', label: 'Export to a file' },
                ],
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async enterOutputPath(initialValue) {
            const result = await text({
                message: 'Output file path',
                placeholder: initialValue,
                initialValue,
                validate(value) {
                    if (value === undefined || !value.trim()) {
                        return 'Enter a path for the output file.';
                    }
                },
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async confirmOverwrite(filePath) {
            const result = await confirm({
                message: `Overwrite ${filePath}?`,
                initialValue: false,
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async chooseCopyFallback() {
            const result = await select({
                message: 'What would you like to do instead?',
                options: [
                    { value: 'print', label: 'Print it here to select and copy' },
                    { value: 'file', label: 'Save it to a file' },
                    { value: 'cancel', label: 'Cancel' },
                ],
            });
            return isCancel(result) ? CANCELLED : result;
        },
        printContent(content) {
            log.message(content, { withGuide: false, spacing: 1 });
        },
        async chooseStructureFormat() {
            const result = await select({
                message: 'Structure file format',
                options: [
                    { value: 'text', label: 'Plain text tree' },
                    { value: 'json', label: 'JSON' },
                ],
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async enterStructurePath(initialValue) {
            const result = await text({
                message: 'Path to the structure file',
                placeholder: initialValue,
                initialValue,
                validate(value) {
                    if (value === undefined || !value.trim()) {
                        return 'Enter a path to a structure file.';
                    }
                    if (!isExistingFile(value.trim())) {
                        return 'No file found at that path.';
                    }
                },
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async enterDestinationDirectory(initialValue) {
            const result = await selectPath({
                message: 'Existing destination directory',
                initialValue,
                directory: true,
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async chooseFileConflictResolution(existingFileCount) {
            const result = await select({
                message: `${existingFileCount} regular file(s) already exist`,
                options: [
                    {
                        value: 'replace',
                        label: 'Replace existing regular files with empty files',
                    },
                    { value: 'skip', label: 'Skip existing files and preserve their contents' },
                    { value: 'cancel', label: 'Cancel creation' },
                ],
            });
            return isCancel(result) ? CANCELLED : result;
        },
        async confirmStructureCreation(summary) {
            const result = await confirm({
                message: `Create this structure? ${summary}`,
                initialValue: false,
            });
            return isCancel(result) ? CANCELLED : result;
        },
        showPreview(preview, summary) {
            log.info(summary);
            log.message(preview);
        },
        async withSpinner(message, doneMessage, task) {
            const progress = spinner();
            progress.start(message);
            try {
                const result = await task();
                progress.stop(doneMessage);
                return result;
            } catch (error) {
                progress.error('Failed');
                throw error;
            }
        },
        warn(message) {
            log.warn(message);
        },
        error(message) {
            log.error(message);
        },
        cancel(message) {
            cancel(message);
        },
        outro,
    };
}
