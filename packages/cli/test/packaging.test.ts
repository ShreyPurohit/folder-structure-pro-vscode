import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const packageDirectory = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(packageDirectory, '..', '..');
const temporaryDirectories: string[] = [];
const SUBPROCESS_TIMEOUT_MS = 180_000;

function runCaptured(
    command: string,
    args: string[],
    cwd: string,
    timeout = SUBPROCESS_TIMEOUT_MS,
    env: NodeJS.ProcessEnv = process.env,
): { status: number; stdout: string; stderr: string } {
    const result = spawnSync(command, args, {
        cwd,
        env,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
        windowsHide: true,
    });

    if (result.error) {
        throw new Error(
            `${command} ${args.join(' ')} failed: ${result.error.message}.\n${result.stderr}\n${result.stdout}`,
            { cause: result.error },
        );
    }

    if (result.status === null) {
        throw new Error(
            `${command} ${args.join(' ')} exited without a status.\n${result.stderr}\n${result.stdout}`,
        );
    }

    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    };
}

function run(command: string, args: string[], cwd: string): string {
    const result = runCaptured(command, args, cwd);

    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} failed with status ${String(result.status)}.\n${result.stderr}\n${result.stdout}`,
        );
    }

    return result.stdout;
}

function expectProcessSuccess(
    result: { status: number; stdout: string; stderr: string },
    description: string,
): void {
    if (result.status !== 0) {
        throw new Error(
            `${description} failed with status ${String(result.status)}.\n${result.stderr}\n${result.stdout}`,
        );
    }
}

function runNpmPack(
    releaseDirectory: string,
    packedDirectory: string,
): { status: number; stdout: string; stderr: string } {
    const args = ['pack', '--ignore-scripts', '--pack-destination', packedDirectory];

    const result =
        process.platform === 'win32'
            ? runWindowsCommand(
                  'npm.cmd',
                  args,
                  releaseDirectory,
                  SUBPROCESS_TIMEOUT_MS,
                  process.env,
              )
            : runCaptured('npm', args, releaseDirectory);

    expectProcessSuccess(result, 'npm pack of the generated release package');

    return result;
}

function runTar(args: string[]): string {
    return run(process.platform === 'win32' ? 'tar.exe' : 'tar', args, packageDirectory);
}

function quoteWindowsArgument(value: string): string {
    if (value.includes('"')) {
        throw new Error('Windows subprocess arguments must not contain quote characters.');
    }

    return /[\s&|<>^()%!]/.test(value) ? `"${value}"` : value;
}

function runWindowsCommand(
    command: string,
    args: string[],
    cwd: string,
    timeout: number,
    env: NodeJS.ProcessEnv,
): { status: number; stdout: string; stderr: string } {
    const commandToken = /\s/.test(command) ? quoteWindowsArgument(command) : command;
    const commandLine = `call ${[commandToken, ...args.map(quoteWindowsArgument)].join(' ')}`;

    return runCaptured(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', commandLine],
        cwd,
        timeout,
        env,
    );
}

function runNpmInstall(
    tarballPath: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
): { status: number; stdout: string; stderr: string } {
    const args = ['install', '--no-audit', '--no-fund', '--no-progress', tarballPath];

    if (process.platform === 'win32') {
        return runWindowsCommand('npm.cmd', args, cwd, SUBPROCESS_TIMEOUT_MS, env);
    }

    return runCaptured('npm', args, cwd, SUBPROCESS_TIMEOUT_MS, env);
}

function runInstalledBinary(
    shimPath: string,
    args: string[],
    cwd: string,
): { status: number; stdout: string; stderr: string } {
    if (process.platform === 'win32') {
        return runWindowsCommand(path.relative(cwd, shimPath), args, cwd, 15_000, process.env);
    }

    return runCaptured(shimPath, args, cwd, 15_000);
}

function isWithinDirectory(directory: string, target: string): boolean {
    const relative = path.relative(directory, target);

    return (
        relative === '' ||
        (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
    );
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            fs.rm(directory, {
                recursive: true,
                force: true,
                maxRetries: 5,
                retryDelay: 200,
            }),
        ),
    );
});

describe('CLI package tarball', () => {
    it('packs, installs, and runs the CLI in an isolated consumer project', async () => {
        const temporaryDirectory = await fs.mkdtemp(
            path.join(os.tmpdir(), 'folder-structure-pro-package-'),
        );

        temporaryDirectories.push(temporaryDirectory);

        const releaseDirectory = path.join(packageDirectory, '.release');
        const packedDirectory = path.join(temporaryDirectory, 'packed');
        const extractedDirectory = path.join(temporaryDirectory, 'extracted');

        await fs.mkdir(packedDirectory);
        await fs.mkdir(extractedDirectory);

        runNpmPack(releaseDirectory, packedDirectory);

        const tarballs = (await fs.readdir(packedDirectory)).filter((file) =>
            file.endsWith('.tgz'),
        );

        expect(tarballs).toHaveLength(1);

        const tarballPath = path.join(packedDirectory, tarballs[0]);

        const listing = runTar(['-tzf', tarballPath])
            .split(/\r?\n/)
            .filter((entry) => entry.length > 0 && !entry.endsWith('/'))
            .sort();

        expect(listing).toEqual(
            [
                'package/LICENSE',
                'package/README.md',
                'package/dist/index.js',
                'package/package.json',
            ].sort(),
        );

        runTar(['-xzf', tarballPath, '-C', extractedDirectory]);

        const packageRoot = path.join(extractedDirectory, 'package');

        const manifest = JSON.parse(
            await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'),
        ) as {
            name?: string;
            version?: string;
            private?: boolean;
            description?: string;
            author?: string;
            keywords?: string[];
            license?: string;
            repository?: { type?: string; url?: string; directory?: string };
            homepage?: string;
            bugs?: { url?: string };
            type?: string;
            engines?: { node?: string };
            bin?: Record<string, string>;
            files?: string[];
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            scripts?: Record<string, string>;
        };

        expect(manifest).toMatchObject({
            name: 'folder-structure-pro',
            version: '0.1.1',
            description: 'CLI to generate, copy, export, and recreate project folder structures.',
            author: 'Shrey Purohit',
            keywords: [
                'folder-structure',
                'folder-structure-cli',
                'directory-structure',
                'directory-structure-cli',
                'directory-tree',
                'folder-tree',
                'project-structure',
                'project-tree',
                'file-tree',
                'directory-visualizer',
                'cli',
                'command-line',
                'filesystem',
                'file-system',
                'developer-tools',
                'scaffolding',
            ],
            license: 'MIT',
            repository: {
                type: 'git',
                url: 'git+https://github.com/ShreyPurohit/folder-structure-pro-vscode.git',
                directory: 'packages/cli',
            },
            homepage: 'https://github.com/ShreyPurohit/folder-structure-pro-vscode#readme',
            bugs: {
                url: 'https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues',
            },
            type: 'module',
            engines: { node: '>=22.14.0' },
            bin: { 'folder-structure-pro': 'dist/index.js' },
            files: ['dist', 'README.md', 'LICENSE'],
        });

        expect(Object.keys(manifest).sort()).toEqual(
            [
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
            ].sort(),
        );

        expect(manifest.private).toBeUndefined();
        expect(manifest.devDependencies).toBeUndefined();
        expect(manifest.scripts).toBeUndefined();
        expect(JSON.stringify(manifest)).not.toContain('workspace:');
        expect(JSON.stringify(manifest)).not.toContain('@folder-structure-pro/core');
        expect(manifest.dependencies).toBeUndefined();

        const executablePath = path.join(packageRoot, manifest.bin!['folder-structure-pro']);

        await expect(fs.access(executablePath)).resolves.toBeUndefined();

        const executable = await fs.readFile(executablePath, 'utf8');

        expect(executable.startsWith('#!/usr/bin/env node')).toBe(true);
        expect(executable).not.toContain('clipboardy');
        expect(executable).not.toContain('from "@clack/prompts"');
        expect(executable).not.toContain('from "@clack/core"');
        expect(executable).not.toContain('from "@folder-structure-pro/core"');

        const rootLicense = await fs.readFile(path.join(repositoryRoot, 'LICENSE'));
        const packageLicense = await fs.readFile(path.join(packageRoot, 'LICENSE'));

        expect(packageLicense).toEqual(rootLicense);

        const sourceReadme = await fs.readFile(path.join(packageDirectory, 'README.md'));
        const packageReadme = await fs.readFile(path.join(packageRoot, 'README.md'));

        expect(packageReadme).toEqual(sourceReadme);

        const consumerDirectory = path.join(temporaryDirectory, 'consumer');
        const consumerNodeModules = path.join(consumerDirectory, 'node_modules');
        const consumerPackageDirectory = path.join(consumerNodeModules, 'folder-structure-pro');
        const consumerPackageJson = path.join(consumerDirectory, 'package.json');

        await fs.mkdir(consumerDirectory);

        const consumerRealPath = await fs.realpath(consumerDirectory);
        const repositoryRealPath = await fs.realpath(repositoryRoot);

        expect(isWithinDirectory(repositoryRealPath, consumerRealPath)).toBe(false);

        await fs.writeFile(
            consumerPackageJson,
            JSON.stringify(
                {
                    name: 'folder-structure-pro-consumer-smoke',
                    version: '1.0.0',
                    private: true,
                },
                null,
                2,
            ),
        );

        const npmCacheDirectory = path.join(temporaryDirectory, 'npm-cache');
        const npmLogsDirectory = path.join(temporaryDirectory, 'npm-logs');

        await fs.mkdir(npmCacheDirectory);
        await fs.mkdir(npmLogsDirectory);

        const npmEnvironment = {
            ...process.env,
            npm_config_cache: npmCacheDirectory,
            npm_config_logs_dir: npmLogsDirectory,
        };

        expectProcessSuccess(
            runNpmInstall(tarballPath, consumerDirectory, npmEnvironment),
            'npm install of the packed CLI',
        );

        await fs.access(npmCacheDirectory);
        await fs.access(npmLogsDirectory);

        const installedManifestPath = path.join(consumerPackageDirectory, 'package.json');
        const installedManifestRealPath = await fs.realpath(installedManifestPath);

        expect(isWithinDirectory(consumerRealPath, installedManifestRealPath)).toBe(true);

        const installedManifest = JSON.parse(await fs.readFile(installedManifestPath, 'utf8')) as {
            name?: string;
            version?: string;
            dependencies?: Record<string, string>;
            bin?: Record<string, string>;
        };

        expect(installedManifest).toMatchObject({
            name: 'folder-structure-pro',
            version: '0.1.1',
            bin: { 'folder-structure-pro': 'dist/index.js' },
        });

        expect(installedManifest.dependencies).toBeUndefined();

        const installedExecutablePath = path.resolve(
            consumerPackageDirectory,
            installedManifest.bin!['folder-structure-pro'],
        );

        const installedExecutableRealPath = await fs.realpath(installedExecutablePath);

        expect(isWithinDirectory(consumerRealPath, installedExecutableRealPath)).toBe(true);

        const installedPackages = (await fs.readdir(consumerNodeModules)).filter(
            (entry) => !entry.startsWith('.'),
        );
        expect(installedPackages).toEqual(['folder-structure-pro']);

        await expect(
            fs.access(path.join(consumerNodeModules, '@folder-structure-pro', 'core')),
        ).rejects.toMatchObject({ code: 'ENOENT' });

        await expect(
            fs.access(path.join(consumerNodeModules, '@clack', 'prompts')),
        ).rejects.toMatchObject({ code: 'ENOENT' });

        const binaryName =
            process.platform === 'win32' ? 'folder-structure-pro.cmd' : 'folder-structure-pro';

        const binaryShimPath = path.join(consumerNodeModules, '.bin', binaryName);

        await fs.access(binaryShimPath);

        if (process.platform !== 'win32') {
            const binaryMetadata = await fs.stat(binaryShimPath);
            expect(binaryMetadata.mode & 0o111).not.toBe(0);
        }

        const help = runInstalledBinary(binaryShimPath, ['--help'], consumerDirectory);

        expectProcessSuccess(help, 'installed CLI help');
        expect(help.stdout).toContain('Usage:');
        expect(help.stdout).toContain('Copy a generated structure to the clipboard');
        expect(help.stdout).toContain('Export a structure to a file or stdout');
        expect(help.stdout).toContain('Create directories and empty files');
        expect(help.stderr).toBe('');

        const sourceDirectory = path.join(consumerDirectory, 'source');

        await fs.mkdir(path.join(sourceDirectory, 'app'), { recursive: true });
        await fs.writeFile(path.join(sourceDirectory, 'app', 'index.ts'), '');

        const outputPath = path.join(consumerDirectory, 'exported.txt');

        const exported = runInstalledBinary(
            binaryShimPath,
            ['export', sourceDirectory, '--output', outputPath],
            consumerDirectory,
        );

        expectProcessSuccess(exported, 'installed CLI file export');
        expect(exported.stdout).toBe('');
        expect(exported.stderr).not.toBe('');

        const exportedStructure = await fs.readFile(outputPath, 'utf8');

        expect(exportedStructure).toContain('app');
        expect(exportedStructure).toContain('index.ts');

        const stdoutExport = runInstalledBinary(
            binaryShimPath,
            ['export', sourceDirectory, '--output', '-'],
            consumerDirectory,
        );

        expectProcessSuccess(stdoutExport, 'installed CLI stdout export');
        expect(stdoutExport.stdout).toBe(`${exportedStructure}\n`);
        expect(stdoutExport.stderr).toBe(
            '\n💙 Thanks for using Folder Structure Pro!\n⭐ Star us on GitHub: https://github.com/ShreyPurohit/folder-structure-pro-vscode\n',
        );

        const destinationDirectory = path.join(consumerDirectory, 'created');

        await fs.mkdir(destinationDirectory);

        const validStructurePath = path.join(consumerDirectory, 'structure.json');

        await fs.writeFile(validStructurePath, '{"app":{"src":{"index.ts":null}}}');

        const created = runInstalledBinary(
            binaryShimPath,
            [
                'create',
                validStructurePath,
                '--format',
                'json',
                '--to',
                destinationDirectory,
                '--yes',
            ],
            consumerDirectory,
        );

        expectProcessSuccess(created, 'installed CLI create');
        expect(created.stdout).toBe('');
        expect(created.stderr).not.toBe('');

        await fs.access(path.join(destinationDirectory, 'app', 'src', 'index.ts'));

        const sentinelPath = path.join(consumerDirectory, 'sentinel.txt');

        await fs.writeFile(sentinelPath, 'sentinel');

        const escapedTarget = path.join(consumerDirectory, 'escaped-target.txt');

        await expect(fs.access(escapedTarget)).rejects.toMatchObject({ code: 'ENOENT' });

        const unsafeStructurePath = path.join(consumerDirectory, 'unsafe.json');

        await fs.writeFile(unsafeStructurePath, '{"../escaped-target.txt":null}');

        const unsafe = runInstalledBinary(
            binaryShimPath,
            [
                'create',
                unsafeStructurePath,
                '--format',
                'json',
                '--to',
                destinationDirectory,
                '--yes',
            ],
            consumerDirectory,
        );

        expect(unsafe.status).not.toBe(0);
        expect(unsafe.stdout).toBe('');
        expect(unsafe.stderr).toContain('safe, portable filesystem name');

        await expect(fs.access(escapedTarget)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(fs.readFile(sentinelPath, 'utf8')).resolves.toBe('sentinel');

        const missingInput = runInstalledBinary(
            binaryShimPath,
            ['create', 'missing.json', '--format', 'json', '--to', destinationDirectory, '--yes'],
            consumerDirectory,
        );

        expect(missingInput.status).not.toBe(0);
        expect(missingInput.stdout).toBe('');
        expect(missingInput.stderr).toContain('NOT_FOUND');

        const malformedInputPath = path.join(consumerDirectory, 'malformed.json');

        await fs.writeFile(malformedInputPath, '{');

        const malformedInput = runInstalledBinary(
            binaryShimPath,
            [
                'create',
                malformedInputPath,
                '--format',
                'json',
                '--to',
                destinationDirectory,
                '--yes',
            ],
            consumerDirectory,
        );

        expect(malformedInput.status).not.toBe(0);
        expect(malformedInput.stdout).toBe('');
        expect(malformedInput.stderr).toMatch(/JSON|property|position/i);
    }, 300_000);
});
