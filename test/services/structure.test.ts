import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { StructureService } from '../../src/services/structure';
import { FileSystemService } from '../../src/services/fileSystem';
import { GitignoreService } from '../../src/services/gitignore';
import { resetVscodeMocks } from '../__mocks__/vscode';
import type { FolderStructure } from '../../src/types';

const PLAIN_TEXT = `Directory structure:
├── app/
│   └── index.ts
└── package.json`;

const MULTI_ROOT = `Directory structure:
├── user-service/
│   └── package.json
│
├── order-service/
│   └── package.json
└── docker-compose.yml`;

function getDirectory(structure: FolderStructure, name: string): FolderStructure {
    const value = structure[name];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Expected "${name}" to be a directory`);
    }
    return value;
}

describe('StructureService', () => {
    beforeEach(() => {
        resetVscodeMocks();
        vi.restoreAllMocks();
    });

    it('derives file types and base names', () => {
        expect(StructureService.fileTypeFor('index.ts')).toBe('ts');
        expect(StructureService.fileTypeFor('Dockerfile')).toBe('file');
        expect(StructureService.baseNameFor('index.ts')).toBe('index');
        expect(StructureService.baseNameFor('README')).toBe('README');
    });

    it('parses plain text into structure with multi-extension support', () => {
        const input = `Directory structure:
└── app/
    ├── package.json
    └── package.lock`;

        const { structure, invalidLines } = StructureService.parsePlainTextToStructure(input);
        expect(invalidLines).toEqual([]);
        expect(structure.app).toEqual({
            package: ['json', 'lock'],
        });
    });

    it('supports multi-root plain text and ignores decorative separator lines', () => {
        const { structure, invalidLines } = StructureService.parsePlainTextToStructure(MULTI_ROOT);
        expect(invalidLines).toEqual([]);
        expect(Object.keys(structure)).toEqual(['user-service', 'order-service', 'docker-compose']);
        expect(structure['docker-compose']).toBe('yml');
    });

    it('marks level gaps as invalid', () => {
        const input = `Directory structure:
└── app/
│   │   │   └── deep.ts`;

        const { invalidLines } = StructureService.parsePlainTextToStructure(input);
        expect(invalidLines.length).toBeGreaterThan(0);
    });

    it('rejects JSON with invalid nested values', () => {
        expect(StructureService.validateJsonStructure({ app: { nested: 123 } })).toBe(false);
    });

    it('marks malformed connector lines as invalid', () => {
        const input = `Directory structure:
├── app/
│   ├── `;

        const { invalidLines } = StructureService.parsePlainTextToStructure(input);
        expect(invalidLines).toContain(3);
    });

    it('validates JSON structures including string[] and null leaves', () => {
        expect(
            StructureService.validateJsonStructure({
                app: {
                    package: ['json', 'lock'],
                    Dockerfile: null,
                },
            }),
        ).toBe(true);
        expect(StructureService.validateJsonStructure({ app: [] })).toBe(false);
        expect(StructureService.validateJsonStructure({ app: ['json', 1] })).toBe(false);
        expect(StructureService.validateJsonStructure(null)).toBe(false);
    });

    it('formats structures by output format', () => {
        const structure = { app: { index: 'ts' } };
        expect(StructureService.formatStructure(structure, 'JSON Format')).toContain(
            '"index": "ts"',
        );
        expect(StructureService.formatAsTree(structure)).toContain('Directory structure:');
    });

    it('builds structure from remote URIs', async () => {
        const root = vscode.Uri.file('/home/user/project');
        const srcUri = vscode.Uri.joinPath(root, 'src');

        vi.spyOn(GitignoreService, 'loadRules').mockResolvedValue(['node_modules']);
        vi.spyOn(FileSystemService, 'readdir').mockImplementation(async (inputPath) => {
            const uri = typeof inputPath === 'string' ? vscode.Uri.file(inputPath) : inputPath;
            if (uri.path.endsWith('/project')) {
                return [
                    { name: 'src', type: vscode.FileType.Directory },
                    { name: 'package.json', type: vscode.FileType.File },
                    { name: 'package.lock', type: vscode.FileType.File },
                    { name: '.gitignore', type: vscode.FileType.File },
                ];
            }
            if (uri.path.endsWith('/src')) {
                return [{ name: 'index.ts', type: vscode.FileType.File }];
            }
            return [];
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

        vi.spyOn(GitignoreService, 'loadRules').mockResolvedValue([]);
        vi.spyOn(FileSystemService, 'readdir').mockImplementation(async (inputPath) => {
            const uri = typeof inputPath === 'string' ? vscode.Uri.file(inputPath) : inputPath;
            if (uri.path.endsWith('/project')) {
                return [
                    { name: 'app', type: vscode.FileType.Directory },
                    { name: 'app.json', type: vscode.FileType.File },
                    { name: 'package.json', type: vscode.FileType.File },
                ];
            }
            if (uri.path.endsWith('/app')) {
                return [{ name: 'index.ts', type: vscode.FileType.File }];
            }
            return [];
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

        vi.spyOn(GitignoreService, 'loadRules').mockResolvedValue([]);
        vi.spyOn(FileSystemService, 'readdir').mockImplementation(async (inputPath) => {
            const uri = typeof inputPath === 'string' ? vscode.Uri.file(inputPath) : inputPath;
            if (uri.path.endsWith('/project')) {
                return [
                    { name: 'app.json', type: vscode.FileType.File },
                    { name: 'app', type: vscode.FileType.Directory },
                ];
            }
            if (uri.path.endsWith('/app')) {
                return [{ name: 'index.ts', type: vscode.FileType.File }];
            }
            return [];
        });

        const structure = await StructureService.getStructure(root);
        const project = getDirectory(structure, 'project');
        expect(project.app).toEqual({ index: 'ts' });
        expect(project['app.json']).toBeNull();
    });

    it('round-trips a directory and multiple colliding files through JSON', async () => {
        const root = vscode.Uri.file('/home/user/project');
        const target = vscode.Uri.file('/tmp/target');

        vi.spyOn(GitignoreService, 'loadRules').mockResolvedValue([]);
        vi.spyOn(FileSystemService, 'readdir').mockImplementation(async (inputPath) => {
            const uri = typeof inputPath === 'string' ? vscode.Uri.file(inputPath) : inputPath;
            if (uri.path.endsWith('/project')) {
                return [
                    { name: 'app', type: vscode.FileType.Directory },
                    { name: 'app.json', type: vscode.FileType.File },
                    { name: 'app.ts', type: vscode.FileType.File },
                ];
            }
            if (uri.path.endsWith('/app')) {
                return [{ name: 'index.ts', type: vscode.FileType.File }];
            }
            return [];
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

    it('parses plain text with both directory and colliding file name', () => {
        const input = `Directory structure:
└── my-app/
    ├── app/
    │   └── index.ts
    ├── app.json
    └── package.json`;

        const { structure, invalidLines } = StructureService.parsePlainTextToStructure(input);
        expect(invalidLines).toEqual([]);
        expect(structure['my-app']).toBeDefined();
        const root = getDirectory(structure, 'my-app');
        expect(root.app).toEqual({ index: 'ts' });
        expect(root['app.json']).toBeNull();
    });

    it('parsePlainTextToStructure strips # inline comments and produces clean names', () => {
        const input = `Directory structure:
├── commands/  # Used for commands
│   └── index.ts
└── setup.ts`;

        const { structure, invalidLines } = StructureService.parsePlainTextToStructure(input);
        expect(invalidLines).toEqual([]);
        expect(structure['commands']).toBeDefined();
        const commands = getDirectory(structure, 'commands');
        expect(commands['index']).toBe('ts');
    });

    it('parsePlainTextToStructure strips // inline comments and produces clean names', () => {
        const input = `Directory structure:
├── services/  // Used for services
│   └── fileSystem.ts
└── setup.ts`;

        const { structure, invalidLines } = StructureService.parsePlainTextToStructure(input);
        expect(invalidLines).toEqual([]);
        expect(structure['services']).toBeDefined();
        const services = getDirectory(structure, 'services');
        expect(services['fileSystem']).toBe('ts');
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

    it('stripInlineComments preserves # inside a JSON quoted string value', () => {
        const line = '  "notes": "Remember #important items"';
        expect(StructureService.stripInlineComments(line)).toBe(line);
    });

    it('stripInlineComments preserves // inside a JSON quoted string value', () => {
        const line = '  "path": "src/http//client.ts"';
        expect(StructureService.stripInlineComments(line)).toBe(line);
    });

    it('stripInlineComments handles escaped quotes inside strings and strips trailing comment', () => {
        // The value "He said \"hello\"" contains escaped quotes; they must NOT end the string early.
        // The comment marker " // comment" appears AFTER the closing quote of the value, so it IS stripped.
        const line = '  "msg": "He said \\"hello\\""  // comment';
        const result = StructureService.stripInlineComments(line);
        // The content inside the string must be preserved.
        expect(result).toContain('"He said \\"hello\\""');
        // The trailing comment after the closing quote must be stripped.
        expect(result).not.toContain('// comment');
        expect(result).toBe('  "msg": "He said \\"hello\\""');
    });

    it('stripInlineComments preserves backslash sequences inside strings and strips the comment', () => {
        const line = '  "path": "C:\\\\Users\\\\file.ts" // comment';
        const result = StructureService.stripInlineComments(line);
        expect(result).toContain('"C:\\\\Users\\\\file.ts"');
        expect(result).not.toContain('// comment');
    });

    it('stripInlineComments strips comment outside quoted string and keeps the JSON value intact', () => {
        const line = '  "index": "ts" // entry point';
        expect(StructureService.stripInlineComments(line)).toBe('  "index": "ts"');
    });
});
