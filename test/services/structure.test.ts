import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { StructureService } from '../../src/services/structure';
import { FileSystemService } from '../../src/services/fileSystem';
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

    it('uses the extension filename semantics when converting parsed names', () => {
        const name = 'folder.name\\file';
        const { structure, invalidLines } = StructureService.parsePlainTextToStructure(
            `Directory structure:\n└── ${name}`,
        );

        expect(invalidLines).toEqual([]);
        expect(structure).toEqual({
            [StructureService.baseNameFor(name)]: StructureService.fileTypeFor(name),
        });
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

    it('creates structures from plain text and JSON', async () => {
        const baseUri = vscode.Uri.file('/tmp/target');
        const mkdir = vi.spyOn(FileSystemService, 'mkdirIfAbsent').mockResolvedValue();
        const write = vi.spyOn(FileSystemService, 'writeFileIfAbsent').mockResolvedValue();

        await StructureService.createStructure(baseUri, PLAIN_TEXT, 'Plain Text Format');
        expect(mkdir).toHaveBeenCalled();
        expect(write).toHaveBeenCalled();

        mkdir.mockClear();
        write.mockClear();

        await StructureService.createStructure(
            baseUri,
            JSON.stringify({
                app: {
                    package: ['json', 'lock'],
                    Dockerfile: null,
                },
            }),
            'JSON Format',
        );

        expect(mkdir).toHaveBeenCalled();
        expect(write).toHaveBeenCalled();
    });

    it('throws for empty or invalid JSON input', async () => {
        const baseUri = vscode.Uri.file('/tmp/target');
        await expect(
            StructureService.createStructure(baseUri, '   ', 'Plain Text Format'),
        ).rejects.toThrow('Plain Text structure cannot be empty.');
        await expect(
            StructureService.createStructure(baseUri, '{ invalid', 'JSON Format'),
        ).rejects.toThrow('Invalid JSON format');
    });

    it('warns when plain text lines are skipped during creation', async () => {
        const baseUri = vscode.Uri.file('/tmp/target');
        vi.spyOn(FileSystemService, 'mkdirIfAbsent').mockResolvedValue();
        vi.spyOn(FileSystemService, 'writeFileIfAbsent').mockResolvedValue();

        await StructureService.createStructure(
            baseUri,
            `Directory structure:
├── app/
invalid-line
│   └── index.ts`,
            'Plain Text Format',
        );

        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
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
        const mkdir = vi.spyOn(FileSystemService, 'mkdirIfAbsent').mockResolvedValue();
        const write = vi.spyOn(FileSystemService, 'writeFileIfAbsent').mockResolvedValue();

        const structure = await StructureService.getStructure(root);
        const project = getDirectory(structure, 'project');
        expect(project.app).toEqual({ index: 'ts' });
        expect(project['app.json']).toBeNull();
        expect(project['app.ts']).toBeNull();

        const json = StructureService.formatStructure(structure, 'JSON Format');
        await StructureService.createStructure(target, json, 'JSON Format');

        expect(mkdir).toHaveBeenCalledWith(vscode.Uri.file('/tmp/target/project/app'));
        expect(write).toHaveBeenCalledWith(vscode.Uri.file('/tmp/target/project/app.json'), '');
        expect(write).toHaveBeenCalledWith(vscode.Uri.file('/tmp/target/project/app.ts'), '');
    });

    it('createStructure handles JSON with # inline comments', async () => {
        const baseUri = vscode.Uri.file('/tmp/target');
        const mkdir = vi.spyOn(FileSystemService, 'mkdirIfAbsent').mockResolvedValue();
        const write = vi.spyOn(FileSystemService, 'writeFileIfAbsent').mockResolvedValue();

        const commentedJson =
            '{\n  "app": { // root folder\n    "index": "ts" # main entry\n  }\n}';
        await StructureService.createStructure(baseUri, commentedJson, 'JSON Format');

        expect(mkdir).toHaveBeenCalled();
        expect(write).toHaveBeenCalled();
    });

    it('createStructure handles JSON with // inline comments', async () => {
        const baseUri = vscode.Uri.file('/tmp/target');
        const mkdir = vi.spyOn(FileSystemService, 'mkdirIfAbsent').mockResolvedValue();
        const write = vi.spyOn(FileSystemService, 'writeFileIfAbsent').mockResolvedValue();

        const commentedJson = '{\n  "src": { // source folder\n    "main": "ts" // entry\n  }\n}';
        await StructureService.createStructure(baseUri, commentedJson, 'JSON Format');

        expect(mkdir).toHaveBeenCalled();
        expect(write).toHaveBeenCalled();
    });
});
