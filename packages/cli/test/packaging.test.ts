import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const packageDirectory = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(packageDirectory, '..', '..');
const temporaryDirectories: string[] = [];

function run(command: string, args: string[], cwd: string): string {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        windowsHide: true,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} failed with status ${String(result.status)}.\n${result.stderr}\n${result.stdout}`,
        );
    }
    return result.stdout;
}

function runPnpm(args: string[]): string {
    const pnpmExecutable = process.env.npm_execpath;
    if (pnpmExecutable && /\.(?:cjs|mjs|js)$/i.test(pnpmExecutable)) {
        return run(process.execPath, [pnpmExecutable, ...args], packageDirectory);
    }
    return run(pnpmExecutable || 'pnpm', args, packageDirectory);
}

function runTar(args: string[]): string {
    return run(process.platform === 'win32' ? 'tar.exe' : 'tar', args, packageDirectory);
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) => fs.rm(directory, { recursive: true, force: true })),
    );
});

describe('CLI package tarball', () => {
    it('contains only intended package files and the expected packed manifest', async () => {
        const temporaryDirectory = await fs.mkdtemp(
            path.join(os.tmpdir(), 'folder-structure-pro-package-'),
        );
        temporaryDirectories.push(temporaryDirectory);
        const packedDirectory = path.join(temporaryDirectory, 'packed');
        const extractedDirectory = path.join(temporaryDirectory, 'extracted');
        await fs.mkdir(packedDirectory);
        await fs.mkdir(extractedDirectory);

        runPnpm(['pack', '--pack-destination', packedDirectory]);

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
        };

        expect(manifest).toMatchObject({
            name: 'folder-structure-pro',
            version: '0.1.0',
            private: true,
            description:
                'Generate, copy, export, and create directory structures from the command line.',
            license: 'MIT',
            repository: {
                type: 'git',
                url: 'https://github.com/ShreyPurohit/folder-structure-pro-vscode.git',
                directory: 'packages/cli',
            },
            homepage: 'https://github.com/ShreyPurohit/folder-structure-pro-vscode#readme',
            bugs: {
                url: 'https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues',
            },
            type: 'module',
            engines: { node: '>=22.14.0' },
            bin: { 'folder-structure-pro': './dist/index.js' },
            files: ['dist', 'README.md', 'LICENSE'],
        });
        expect(JSON.stringify(manifest)).not.toContain('workspace:');
        expect(manifest.dependencies).toEqual({ clipboardy: '5.3.2' });
        expect(manifest.dependencies).not.toHaveProperty('@clack/prompts');
        expect(manifest.dependencies).not.toHaveProperty('@folder-structure-pro/core');
        expect(manifest.devDependencies?.['@clack/prompts']).toBe('1.9.0');
        expect(manifest.devDependencies?.['@folder-structure-pro/core']).toBe('0.1.0');

        const executablePath = path.join(packageRoot, manifest.bin!['folder-structure-pro']);
        await expect(fs.access(executablePath)).resolves.toBeUndefined();
        const executable = await fs.readFile(executablePath, 'utf8');
        expect(executable.startsWith('#!/usr/bin/env node')).toBe(true);
        expect(executable).toContain('from "clipboardy"');
        expect(executable).not.toContain('from "@clack/prompts"');
        expect(executable).not.toContain('from "@clack/core"');
        expect(executable).not.toContain('from "@folder-structure-pro/core"');

        const rootLicense = await fs.readFile(path.join(repositoryRoot, 'LICENSE'));
        const packageLicense = await fs.readFile(path.join(packageRoot, 'LICENSE'));
        expect(packageLicense).toEqual(rootLicense);
    });
});
