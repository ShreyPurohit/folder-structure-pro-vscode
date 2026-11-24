import { parseArgs } from 'node:util';

export type ConflictPolicy = 'fail' | 'skip' | 'replace';
export type StructureInputFormat = 'text' | 'json';

export interface ScanCommandOptions {
    directory: string;
    format: 'text' | 'json';
    maxDepth?: number;
    ignorePatterns: string[];
    includeHidden: boolean;
    respectGitignore: boolean;
}

export type ParsedCliArguments =
    | { kind: 'interactive' }
    | { kind: 'help'; command?: 'copy' | 'export' | 'create' }
    | { kind: 'copy'; options: ScanCommandOptions }
    | {
          kind: 'export';
          options: ScanCommandOptions;
          output: string;
          force: boolean;
      }
    | {
          kind: 'create';
          /** A file path, or "-" to read the structure from standard input. */
          structureFile: string;
          /** Undefined means "detect it": JSON when the text starts with "{". */
          format?: StructureInputFormat;
          destination: string;
          onConflict: ConflictPolicy;
      };

export class CliArgumentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CliArgumentError';
    }
}

const COMMANDS = ['copy', 'export', 'create'] as const;
type Command = (typeof COMMANDS)[number];

const ARGUMENT_OPTIONS = {
    depth: { type: 'string' },
    exclude: { type: 'string', multiple: true },
    force: { type: 'boolean' },
    format: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
    hidden: { type: 'boolean' },
    'no-gitignore': { type: 'boolean' },
    'on-conflict': { type: 'string' },
    output: { type: 'string' },
    to: { type: 'string' },
    yes: { type: 'boolean' },
} as const;

function isCommand(value: string): value is Command {
    return COMMANDS.some((command) => command === value);
}

function assertOnlyOptions(
    values: Record<string, string | boolean | string[] | undefined>,
    allowed: readonly string[],
): void {
    for (const [name, value] of Object.entries(values)) {
        if (value !== undefined && !allowed.includes(name)) {
            throw new CliArgumentError(`Option --${name} is not valid for this command.`);
        }
    }
}

function requiredString(
    values: Record<string, string | boolean | string[] | undefined>,
    name: string,
): string {
    const value = values[name];
    if (typeof value !== 'string' || value.length === 0) {
        throw new CliArgumentError(`Option --${name} requires a value.`);
    }
    return value;
}

function parseFormat(value: string | boolean | string[] | undefined): 'text' | 'json' {
    if (value === undefined) {
        return 'text';
    }
    if (value === 'text' || value === 'json') {
        return value;
    }
    throw new CliArgumentError('Option --format must be either text or json.');
}

function parseScanOptions(
    directory: string | undefined,
    values: Record<string, string | boolean | string[] | undefined>,
): ScanCommandOptions {
    const format = parseFormat(values.format);
    const rawDepth = values.depth;
    let maxDepth: number | undefined;
    if (rawDepth !== undefined) {
        if (typeof rawDepth !== 'string' || !/^\d+$/.test(rawDepth)) {
            throw new CliArgumentError('Option --depth must be a non-negative whole number.');
        }
        maxDepth = Number(rawDepth);
        if (!Number.isSafeInteger(maxDepth)) {
            throw new CliArgumentError('Option --depth must be a non-negative whole number.');
        }
    }
    const rawPatterns = values.exclude;
    let ignorePatterns: string[];
    if (rawPatterns === undefined) {
        ignorePatterns = [];
    } else if (typeof rawPatterns === 'string') {
        ignorePatterns = [rawPatterns];
    } else if (Array.isArray(rawPatterns)) {
        ignorePatterns = rawPatterns;
    } else {
        throw new CliArgumentError('Option --exclude requires a pattern.');
    }
    if (ignorePatterns.some((pattern) => pattern.trim().length === 0)) {
        throw new CliArgumentError('Option --exclude requires a non-empty pattern.');
    }

    return {
        directory: directory || '.',
        format,
        maxDepth,
        ignorePatterns,
        includeHidden: values.hidden === true,
        respectGitignore: values['no-gitignore'] !== true,
    };
}

export function parseCliArguments(args: readonly string[]): ParsedCliArguments {
    if (args.length === 0) {
        return { kind: 'interactive' };
    }

    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs({
            args: [...args],
            options: ARGUMENT_OPTIONS,
            allowPositionals: true,
            strict: true,
        });
    } catch (error) {
        throw new CliArgumentError(error instanceof Error ? error.message : 'Invalid arguments.');
    }

    const [commandName, ...positionals] = parsed.positionals;
    if (!commandName) {
        if (parsed.values.help) {
            return { kind: 'help' };
        }
        throw new CliArgumentError('A command is required when command-line options are supplied.');
    }
    if (!isCommand(commandName)) {
        throw new CliArgumentError(`Unknown command "${commandName}".`);
    }
    if (parsed.values.help) {
        return { kind: 'help', command: commandName };
    }

    const values = parsed.values as Record<string, string | boolean | string[] | undefined>;
    if (commandName === 'copy') {
        assertOnlyOptions(values, ['depth', 'exclude', 'format', 'help', 'hidden', 'no-gitignore']);
        if (positionals.length > 1) {
            throw new CliArgumentError('copy accepts at most one directory argument.');
        }
        return {
            kind: 'copy',
            options: parseScanOptions(positionals[0], values),
        };
    }

    if (commandName === 'export') {
        assertOnlyOptions(values, [
            'depth',
            'exclude',
            'force',
            'format',
            'help',
            'hidden',
            'no-gitignore',
            'output',
        ]);
        if (positionals.length > 1) {
            throw new CliArgumentError('export accepts at most one directory argument.');
        }
        return {
            kind: 'export',
            options: parseScanOptions(positionals[0], values),
            output: requiredString(values, 'output'),
            force: values.force === true,
        };
    }

    assertOnlyOptions(values, ['format', 'help', 'on-conflict', 'to', 'yes']);
    if (positionals.length !== 1) {
        throw new CliArgumentError('create requires exactly one structure-file argument.');
    }
    if (values.format !== undefined && values.format !== 'text' && values.format !== 'json') {
        throw new CliArgumentError('Option --format must be either text or json.');
    }
    if (values.yes !== true) {
        throw new CliArgumentError('create requires --yes in non-interactive mode.');
    }

    const rawConflictPolicy = values['on-conflict'];
    const onConflict = rawConflictPolicy === undefined ? 'fail' : rawConflictPolicy;
    if (onConflict !== 'fail' && onConflict !== 'skip' && onConflict !== 'replace') {
        throw new CliArgumentError('--on-conflict must be fail, skip, or replace.');
    }

    return {
        kind: 'create',
        structureFile: positionals[0],
        format: values.format,
        destination: typeof values.to === 'string' ? values.to : '.',
        onConflict,
    };
}

const GENERAL_HELP = `Folder Structure Pro

Usage:
  folder-structure-pro
  folder-structure-pro <command> [options]

Commands:
  copy [directory]                 Copy a generated structure to the clipboard
  export [directory] --output <file|->
                                   Export a structure to a file or stdout
  create <structure-file|->        Create directories and empty files

Use "folder-structure-pro <command> --help" for command options.
With no arguments, the interactive menu is available in a TTY.
`;

const COMMAND_HELP: Record<Command, string> = {
    copy: `Usage: folder-structure-pro copy [directory] [options]

Options:
  --format <text|json>  Output format (default: text)
  --depth <number>      Maximum traversal depth
  --exclude <pattern>   Additional ignore pattern; may be repeated
  --hidden              Include hidden entries
  --no-gitignore        Do not respect the root .gitignore
  -h, --help            Show this help

The generated structure is copied to the clipboard (over SSH or without a
desktop session, the terminal's OSC 52 clipboard support is used). Clipboard failures are
reported on stderr; output is never redirected to another destination.
`,
    export: `Usage: folder-structure-pro export [directory] --output <file|->

Options:
  --output <file|->     Required; use - to write only structure data to stdout
  --force               Replace an existing regular output file
  --format <text|json>  Output format (default: text)
  --depth <number>      Maximum traversal depth
  --exclude <pattern>   Additional ignore pattern; may be repeated
  --hidden              Include hidden entries
  --no-gitignore        Do not respect the root .gitignore
  -h, --help            Show this help

The output parent directory must already exist. Existing files are not
overwritten unless --force is supplied.
`,
    create: `Usage: folder-structure-pro create <structure-file|-> --yes [options]
Use - as the structure file to read it from standard input, for example:
  pbpaste | folder-structure-pro create - --to ./new-project --yes

Options:
  --format <text|json>       Structure format (default: detected from the content)
  --to <directory>           Existing destination (default: current directory)
  --on-conflict <policy>     fail (default), skip, or replace
  --yes                      Required to execute non-interactively
  -h, --help                 Show this help

Replacing existing regular files requires --on-conflict replace and --yes.
Creation is all or nothing: if a step fails, everything it created is removed.
`,
};

export function formatCliHelp(command?: Command): string {
    return command ? COMMAND_HELP[command] : GENERAL_HELP;
}
