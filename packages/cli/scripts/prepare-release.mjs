import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(packageDirectory, '..', '..');
const releaseDirectory = path.join(packageDirectory, '.release');
const manifestPath = path.join(packageDirectory, 'package.json');

const manifestFields = [
    'name',
    'version',
    'description',
    'author',
    'keywords',
    'repository',
    'homepage',
    'bugs',
    'license',
    'type',
    'engines',
    'bin',
    'files',
];

function quoteWindowsArgument(value) {
    if (value.includes('"')) {
        throw new Error('Windows command arguments must not contain quote characters.');
    }
    return /[\s&|<>^()%!]/.test(value) ? `"${value}"` : value;
}

function runPnpm(args) {
    const pnpmExecutable = process.env.npm_execpath;
    const hasPnpmScript = pnpmExecutable && /\.(?:cjs|mjs|js)$/i.test(pnpmExecutable);
    let command;
    let commandArgs;

    if (hasPnpmScript) {
        command = process.execPath;
        commandArgs = [pnpmExecutable, ...args];
    } else if (process.platform === 'win32') {
        command = process.env.ComSpec || 'cmd.exe';
        commandArgs = [
            '/d',
            '/s',
            '/c',
            `call ${['pnpm.cmd', ...args].map(quoteWindowsArgument).join(' ')}`,
        ];
    } else {
        command = 'pnpm';
        commandArgs = args;
    }

    const result = spawnSync(command, commandArgs, {
        cwd: repositoryRoot,
        stdio: 'inherit',
        windowsHide: true,
    });

    if (result.error) {
        throw new Error(`Failed to run ${command} ${args.join(' ')}: ${result.error.message}`, {
            cause: result.error,
        });
    }

    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} exited with status ${String(result.status)}.`,
        );
    }
}

async function requireRegularFile(filePath) {
    let metadata;

    try {
        metadata = await fs.lstat(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Required release input is missing: ${filePath}`, { cause: error });
        }
        throw error;
    }

    if (!metadata.isFile()) {
        throw new Error(`Required release input is not a regular file: ${filePath}`);
    }
}

async function readWorkspaceManifest() {
    const contents = await fs.readFile(manifestPath, 'utf8');
    let manifest;

    try {
        manifest = JSON.parse(contents);
    } catch (error) {
        throw new Error(`Unable to parse the CLI workspace manifest at ${manifestPath}.`, {
            cause: error,
        });
    }

    if (manifest.name !== 'folder-structure-pro') {
        throw new Error(`Unexpected CLI package name: ${String(manifest.name)}.`);
    }

    if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
        throw new Error('The CLI workspace manifest must define a package version.');
    }

    if (JSON.stringify(manifest.files) !== JSON.stringify(['dist', 'README.md', 'LICENSE'])) {
        throw new Error('The CLI workspace manifest has an unexpected package file allowlist.');
    }

    if (
        manifest.author !== 'Shrey Purohit' ||
        !Array.isArray(manifest.keywords) ||
        manifest.keywords.length === 0 ||
        manifest.repository?.url !==
            'git+https://github.com/ShreyPurohit/folder-structure-pro-vscode.git' ||
        manifest.bin?.['folder-structure-pro'] !== 'dist/index.js' ||
        (manifest.dependencies !== undefined && Object.keys(manifest.dependencies).length > 0)
    ) {
        throw new Error(
            'The CLI workspace manifest has unexpected executable or runtime metadata.',
        );
    }

    const publicManifest = {};

    for (const field of manifestFields) {
        if (manifest[field] === undefined) {
            throw new Error(`The CLI workspace manifest is missing required field "${field}".`);
        }

        publicManifest[field] = manifest[field];
    }

    return publicManifest;
}

async function removePreviousReleaseDirectory() {
    const relativeDirectory = path.relative(packageDirectory, releaseDirectory);

    if (relativeDirectory !== '.release') {
        throw new Error('The generated release directory resolved outside the CLI package.');
    }

    try {
        const metadata = await fs.lstat(releaseDirectory);

        if (metadata.isSymbolicLink()) {
            throw new Error(`Refusing to replace a symlink at ${releaseDirectory}.`);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    await fs.rm(releaseDirectory, { recursive: true, force: true });
}

async function prepareRelease() {
    const publicManifest = await readWorkspaceManifest();

    await removePreviousReleaseDirectory();

    runPnpm(['--filter', 'folder-structure-pro', 'build']);

    const inputs = [
        path.join(packageDirectory, 'dist', 'index.js'),
        path.join(packageDirectory, 'README.md'),
        path.join(packageDirectory, 'LICENSE'),
    ];

    await Promise.all(inputs.map(requireRegularFile));

    const releaseDistDirectory = path.join(releaseDirectory, 'dist');

    await fs.mkdir(releaseDistDirectory, { recursive: true });
    await fs.copyFile(inputs[0], path.join(releaseDistDirectory, 'index.js'));
    await fs.copyFile(inputs[1], path.join(releaseDirectory, 'README.md'));
    await fs.copyFile(inputs[2], path.join(releaseDirectory, 'LICENSE'));

    await fs.writeFile(
        path.join(releaseDirectory, 'package.json'),
        `${JSON.stringify(publicManifest, null, 2)}\n`,
        'utf8',
    );

    process.stdout.write(`Prepared npm release package at ${releaseDirectory}\n`);
}

await prepareRelease();
