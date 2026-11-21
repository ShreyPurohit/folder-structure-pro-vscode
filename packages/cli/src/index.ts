import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { runExecutable } from './cli.js';

export { runCli, type CliDependencies } from './cli.js';
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
