import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { runExecutable } from './cli.js';

export {
    runCli,
    runExecutable,
    type CliDependencies,
    type CliWriter,
    type ExecutableDependencies,
    type RunExecutableOptions,
} from './cli.js';
export {
    CliArgumentError,
    formatCliHelp,
    parseCliArguments,
    type ConflictPolicy,
    type ParsedCliArguments,
    type ScanCommandOptions,
} from './arguments.js';
export { NodeFileSystemAdapter } from './adapters/nodeFileSystem.js';
export {
    CANCELLED,
    type Cancelled,
    type CliFilters,
    type CliPrompts,
    type PromptResult,
} from './presentation.js';

const isExecutableEntry =
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isExecutableEntry) {
    process.exitCode = await runExecutable();
}
