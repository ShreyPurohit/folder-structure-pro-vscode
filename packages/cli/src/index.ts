import { realpathSync } from 'node:fs';
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

function pathsMatch(left: string, right: string): boolean {
    return process.platform === 'win32'
        ? path.win32.normalize(left).toLowerCase() === path.win32.normalize(right).toLowerCase()
        : left === right;
}

function isExecutableEntry(): boolean {
    const argumentPath = process.argv[1];
    if (argumentPath === undefined) {
        return false;
    }

    const entryPath = path.resolve(argumentPath);
    const modulePath = path.resolve(fileURLToPath(import.meta.url));
    try {
        return pathsMatch(realpathSync(entryPath), realpathSync(modulePath));
    } catch {
        return false;
    }
}

if (isExecutableEntry()) {
    process.exitCode = await runExecutable();
}
