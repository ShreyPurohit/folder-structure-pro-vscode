import {
    cancel,
    confirm,
    intro,
    isCancel,
    log,
    multiselect,
    outro,
    select,
    text,
} from '@clack/prompts';

export const CANCELLED = { kind: 'cancelled' } as const;
export type Cancelled = typeof CANCELLED;
export type PromptResult<T> = T | Cancelled;

export interface CliFilters {
    includeHidden: boolean;
    respectGitignore: boolean;
}

export interface CliPrompts {
    intro(message: string): void;
    chooseTarget(initialValue: string): Promise<PromptResult<string>>;
    chooseFormat(): Promise<PromptResult<'text' | 'json'>>;
    chooseFilters(): Promise<PromptResult<CliFilters>>;
    enterIgnorePatterns(): Promise<PromptResult<string>>;
    enterMaxDepth(): Promise<PromptResult<string>>;
    chooseDestination(): Promise<PromptResult<'clipboard' | 'file'>>;
    enterOutputPath(initialValue: string): Promise<PromptResult<string>>;
    confirmOverwrite(filePath: string): Promise<PromptResult<boolean>>;
    showPreview(preview: string, summary: string): void;
    error(message: string): void;
    cancel(message: string): void;
    outro(message: string): void;
}

export function createCliPrompts(): CliPrompts {
    return {
        intro,
        async chooseTarget(initialValue) {
            const result = await text({
                message: 'Directory to scan',
                placeholder: initialValue,
                initialValue,
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
        showPreview(preview, summary) {
            log.info(summary);
            log.message(preview);
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
