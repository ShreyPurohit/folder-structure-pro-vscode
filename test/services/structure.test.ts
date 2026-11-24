import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StructureInputResult } from '@folder-structure-pro/core';
import * as vscode from 'vscode';
import { StructureService } from '../../src/services/structure';
import { installMemoryWorkspaceFs } from '../helpers/memoryWorkspaceFs';
import { GitignoreService } from '../../src/services/gitignore';
import {
    mockFsReadDirectory,
    mockFsReadFile,
    mockFsStat,
    resetVscodeMocks,
} from '../__mocks__/vscode';
import type { FolderStructure } from '../../src/types';

const PLAIN_TEXT = `Directory structure:
├── app/
│   └── index.ts
└── package.json`;

function structureOf(result: StructureInputResult): FolderStructure {
    if (!result.ok) {
        throw new Error(`Expected a valid structure, got: ${result.message}`);
    }
    return result.structure;
}

/** Reads, plans and creates, exactly as the Create command does. */
async function createAt(path: string, text: string, format: 'Plain Text Format' | 'JSON Format') {
    const plan = await StructureService.planCreation(
        vscode.Uri.file(path),
        structureOf(StructureService.readStructure(text, format)),
    );
    return StructureService.executeCreation(plan, 'skip');
}

function getDirectory(structure: FolderStructure, name: string): FolderStructure {
    const value = structure[name];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Expected "${name}" to be a directory`);
    }
    return value;
}

type MockTree = Record<string, [string, vscode.FileType][]>;

function configureTree(tree: MockTree): void {
    mockFsReadDirectory.mockImplementation(async (uri) => tree[uri.path] ?? []);
    mockFsStat.mockImplementation(async (uri) => {
        if (Object.prototype.hasOwnProperty.call(tree, uri.path)) {
            return { type: vscode.FileType.Directory };
        }
        for (const [directoryPath, entries] of Object.entries(tree)) {
            const entry = entries.find(([name]) => `${directoryPath}/${name}` === uri.path);
            if (entry) {
                return { type: entry[1] };
            }
        }
        throw Object.assign(new Error('File not found'), { code: 'FileNotFound' });
    });
    mockFsReadFile.mockResolvedValue(new TextEncoder().encode(''));
}

describe('StructureService', () => {
    beforeEach(() => {
        resetVscodeMocks();
        vi.restoreAllMocks();
    });

    it('preserves host path semantics for extension filename helpers', () => {
        expect(StructureService.fileTypeFor('index.ts')).toBe('ts');
        expect(StructureService.fileTypeFor('Dockerfile')).toBe('file');
        expect(StructureService.baseNameFor('index.ts')).toBe('index');
        expect(StructureService.baseNameFor('README')).toBe('README');
    });

    it('uses the extension filename semantics when reading a structure', () => {
        const name = 'folder.name\\file';
        const result = StructureService.readStructure(
            `Directory structure:\n└── ${name}`,
            'Plain Text Format',
        );
        expect(structureOf(result)).toEqual({
            [StructureService.baseNameFor(name)]: StructureService.fileTypeFor(name),
        });
    });

    it('creates structures from plain text and JSON with the shared core', async () => {
        const fs = installMemoryWorkspaceFs({ '/tmp/target': null });

        await createAt('/tmp/target', PLAIN_TEXT, 'Plain Text Format');
        expect(fs.read('/tmp/target/app/index.ts')).toBe('');
        expect(fs.read('/tmp/target/package.json')).toBe('');

        await createAt(
            '/tmp/target',
            JSON.stringify({ lib: { package: ['json', 'lock'], Dockerfile: null } }),
            'JSON Format',
        );
        expect(fs.read('/tmp/target/lib/package.json')).toBe('');
        expect(fs.read('/tmp/target/lib/package.lock')).toBe('');
        expect(fs.read('/tmp/target/lib/Dockerfile')).toBe('');
    });

    it('keeps the root folder of a tree pasted without the heading', async () => {
        const fs = installMemoryWorkspaceFs({ '/tmp/target': null });
        await createAt('/tmp/target', '└── app/\n    └── index.ts', 'Plain Text Format');
        expect(fs.read('/tmp/target/app/index.ts')).toBe('');
    });

    it('reports empty, unreadable and invalid input', () => {
        expect(StructureService.readStructure('   ', 'Plain Text Format')).toMatchObject({
            ok: false,
            message: 'Empty input or no valid lines.',
        });
        expect(StructureService.readStructure('{ invalid', 'JSON Format')).toMatchObject({
            ok: false,
            message: expect.stringMatching(/^Invalid JSON: /),
        });
        expect(
            StructureService.readStructure(
                'Directory structure:\n└── app/\n            └── index.ts',
                'Plain Text Format',
            ),
        ).toMatchObject({
            ok: false,
            invalidLines: [{ line: 3, text: '            └── index.ts' }],
        });
    });

    it('refuses names that would escape the destination, before creating anything', async () => {
        const fs = installMemoryWorkspaceFs({ '/tmp/target': null, '/tmp/outside': null });
        const before = fs.snapshot();
        const result = StructureService.readStructure(
            JSON.stringify({ '../outside': { evil: 'ts' } }),
            'JSON Format',
        );
        await expect(
            StructureService.planCreation(vscode.Uri.file('/tmp/target'), structureOf(result)),
        ).rejects.toThrow('not a safe, portable filesystem name');
        expect(fs.snapshot()).toEqual(before);
    });

    it.each([
        [
            '# comments',
            '{\n  "app": { // root folder\n    "index": "ts" # main entry\n  }\n}',
            '/tmp/target/app/index.ts',
        ],
        [
            '// comments',
            '{\n  "src": { // source folder\n    "main": "ts" // entry\n  }\n}',
            '/tmp/target/src/main.ts',
        ],
    ])('creates JSON with %s', async (_label, json, created) => {
        const fs = installMemoryWorkspaceFs({ '/tmp/target': null });
        await createAt('/tmp/target', json, 'JSON Format');
        expect(fs.read(created)).toBe('');
    });

    it('builds structure from remote URIs', async () => {
        const root = vscode.Uri.from({
            scheme: 'vscode-remote',
            authority: 'ssh-remote+example',
            path: '/home/user/project',
        });
        const srcUri = vscode.Uri.joinPath(root, 'src');

        vi.spyOn(GitignoreService, 'getTraversalOptions').mockReturnValue({
            ignorePatterns: ['node_modules'],
            respectGitignore: false,
        });
        configureTree({
            '/home/user/project': [
                ['src', vscode.FileType.Directory],
                ['package.json', vscode.FileType.File],
                ['package.lock', vscode.FileType.File],
                ['.gitignore', vscode.FileType.File],
            ],
            '/home/user/project/src': [['index.ts', vscode.FileType.File]],
        });

        const structure = await StructureService.getStructure(root);
        expect(structure.project).toEqual({
            src: { index: 'ts' },
            package: ['json', 'lock'],
        });
        expect(srcUri.path).toContain('/src');
    });

    it('preserves both directory and file when sharing the same basename (dir before file)', async () => {
        const root = vscode.Uri.file('/home/user/project');

        vi.spyOn(GitignoreService, 'getTraversalOptions').mockReturnValue({
            ignorePatterns: [],
            respectGitignore: false,
        });
        configureTree({
            '/home/user/project': [
                ['app', vscode.FileType.Directory],
                ['app.json', vscode.FileType.File],
                ['package.json', vscode.FileType.File],
            ],
            '/home/user/project/app': [['index.ts', vscode.FileType.File]],
        });

        const structure = await StructureService.getStructure(root);
        const project = getDirectory(structure, 'project');
        expect(project.app).toEqual({ index: 'ts' });
        expect(project['app.json']).toBeNull();

        const plainText = StructureService.formatStructure(structure, 'Plain Text Format');
        expect(plainText).toContain('app/');
        expect(plainText).toContain('index.ts');
        expect(plainText).toContain('app.json');
    });

    it('preserves both directory and file when sharing the same basename (file before dir)', async () => {
        const root = vscode.Uri.file('/home/user/project');

        vi.spyOn(GitignoreService, 'getTraversalOptions').mockReturnValue({
            ignorePatterns: [],
            respectGitignore: false,
        });
        configureTree({
            '/home/user/project': [
                ['app.json', vscode.FileType.File],
                ['app', vscode.FileType.Directory],
            ],
            '/home/user/project/app': [['index.ts', vscode.FileType.File]],
        });

        const structure = await StructureService.getStructure(root);
        const project = getDirectory(structure, 'project');
        expect(project.app).toEqual({ index: 'ts' });
        expect(project['app.json']).toBeNull();
    });

    it('round-trips a directory and multiple colliding files through JSON', async () => {
        const root = vscode.Uri.file('/home/user/project');
        const target = vscode.Uri.file('/tmp/target');

        vi.spyOn(GitignoreService, 'getTraversalOptions').mockReturnValue({
            ignorePatterns: [],
            respectGitignore: false,
        });
        configureTree({
            '/home/user/project': [
                ['app', vscode.FileType.Directory],
                ['app.json', vscode.FileType.File],
                ['app.ts', vscode.FileType.File],
            ],
            '/home/user/project/app': [['index.ts', vscode.FileType.File]],
        });
        const structure = await StructureService.getStructure(root);
        const project = getDirectory(structure, 'project');
        expect(project.app).toEqual({ index: 'ts' });
        expect(project['app.json']).toBeNull();
        expect(project['app.ts']).toBeNull();
        const json = StructureService.formatStructure(structure, 'JSON Format');
        const fs = installMemoryWorkspaceFs({ [target.path]: null });
        await createAt(target.path, json, 'JSON Format');
        expect(fs.read('/tmp/target/project/app/index.ts')).toBe('');
        expect(fs.read('/tmp/target/project/app.json')).toBe('');
        expect(fs.read('/tmp/target/project/app.ts')).toBe('');
    });
});
