import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const packageDirectory = path.resolve(import.meta.dirname, '..');
const bundlePath = path.join(packageDirectory, 'dist', 'index.js');
const manifestPath = path.join(packageDirectory, 'package.json');

describe('CLI bundle', () => {
    it('is an ESM executable with bundled dependencies and external Node built-ins', async () => {
        const bundle = await fs.readFile(bundlePath, 'utf8');
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
            dependencies?: Record<string, string>;
            private?: boolean;
        };

        expect(bundle.startsWith('#!/usr/bin/env node')).toBe(true);
        expect(bundle).toContain('FolderFileSystemError');
        expect(bundle).toContain('from "node:fs/promises"');
        expect(bundle).toContain('from "node:path"');
        expect(bundle).not.toContain('@folder-structure-pro/core');
        expect(bundle).toContain('from "clipboardy"');
        expect(bundle).not.toContain('from "@clack/prompts"');
        expect(JSON.stringify(manifest.dependencies ?? {})).not.toContain('workspace:');
        expect(manifest.private).toBe(true);
    });

    it('gives a useful non-TTY message and nonzero status', () => {
        const result = spawnSync(process.execPath, [bundlePath], { encoding: 'utf8' });

        expect(result.status).toBe(2);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('Interactive mode requires a TTY');
        expect(result.stderr).not.toContain('Error:');
    });

    it('supports cancellation, expected errors, and success through injected dependencies', async () => {
        const bundled = (await import(
            pathToFileURL(bundlePath).href
        )) as typeof import('../src/index.js');
        const temporaryDirectory = await fs.mkdtemp(
            path.join(os.tmpdir(), 'folder-structure-cli-bundle-'),
        );
        try {
            await fs.writeFile(path.join(temporaryDirectory, 'hello.txt'), '');

            const prompts = {
                intro: () => {},
                chooseOperation: async () => 'copy' as const,
                chooseTarget: async () => '',
                chooseFormat: async () => 'text' as const,
                chooseFilters: async () => ({
                    includeHidden: false,
                    respectGitignore: true,
                }),
                enterIgnorePatterns: async () => '',
                enterMaxDepth: async () => '',
                chooseDestination: async () => 'clipboard' as const,
                enterOutputPath: async () => 'output.txt',
                confirmOverwrite: async () => false,
                chooseStructureFormat: async () => 'text' as const,
                enterStructurePath: async () => 'structure.txt',
                enterDestinationDirectory: async () => '',
                chooseFileConflictResolution: async () => 'skip' as const,
                confirmStructureCreation: async () => false,
                showPreview: () => {},
                error: vi.fn(),
                cancel: vi.fn(),
                outro: vi.fn(),
            };
            const clipboard = { write: vi.fn().mockResolvedValue(undefined) };
            const fileSystem = new bundled.NodeFileSystemAdapter();

            await expect(
                bundled.runCli({
                    fileSystem,
                    clipboard,
                    prompts: {
                        ...prompts,
                        chooseTarget: async () => bundled.CANCELLED,
                    },
                    cwd: temporaryDirectory,
                }),
            ).resolves.toBe(0);

            const failedPrompts = { ...prompts };
            await expect(
                bundled.runCli({
                    fileSystem,
                    clipboard,
                    prompts: {
                        ...failedPrompts,
                        chooseTarget: async () => path.join(temporaryDirectory, 'missing'),
                    },
                    cwd: temporaryDirectory,
                }),
            ).resolves.toBe(1);
            expect(failedPrompts.error).toHaveBeenCalledWith(expect.stringContaining('NOT_FOUND'));

            await expect(
                bundled.runCli({
                    fileSystem,
                    clipboard,
                    prompts,
                    cwd: temporaryDirectory,
                }),
            ).resolves.toBe(0);
            expect(clipboard.write).toHaveBeenCalledWith(expect.stringContaining('hello.txt'));
            expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining('Copied 1 entry'));

            const structurePath = path.join(temporaryDirectory, 'creation-input.txt');
            const destinationPath = path.join(temporaryDirectory, 'created');
            await fs.writeFile(structurePath, 'Directory structure:\n└── app/\n    └── index.ts');
            await fs.mkdir(destinationPath);
            const creationPrompts = {
                ...prompts,
                chooseOperation: async () => 'create' as const,
                chooseStructureFormat: async () => 'text' as const,
                enterStructurePath: async () => structurePath,
                enterDestinationDirectory: async () => destinationPath,
                confirmStructureCreation: async () => true,
                outro: vi.fn(),
            };
            await expect(
                bundled.runCli({
                    fileSystem,
                    clipboard,
                    prompts: creationPrompts,
                    cwd: temporaryDirectory,
                }),
            ).resolves.toBe(0);
            await expect(
                fs.readFile(path.join(destinationPath, 'app', 'index.ts'), 'utf8'),
            ).resolves.toBe('');
            expect(creationPrompts.outro).toHaveBeenCalledWith(
                expect.stringContaining('Created 1 directory and 1 file'),
            );
        } finally {
            await fs.rm(temporaryDirectory, { recursive: true, force: true });
        }
    });
});
