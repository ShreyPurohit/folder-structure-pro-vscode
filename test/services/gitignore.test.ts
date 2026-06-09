import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { GitignoreService } from '../../src/services/gitignore';
import { FileSystemService } from '../../src/services/fileSystem';
import { resetVscodeMocks, mockConfigurationGet } from '../__mocks__/vscode';

describe('GitignoreService', () => {
    beforeEach(() => {
        resetVscodeMocks();
        vi.restoreAllMocks();
    });

    it('loads default ignore patterns from configuration', async () => {
        const dirUri = vscode.Uri.file('/workspace/project');
        await expect(GitignoreService.loadRules(dirUri)).resolves.toEqual(['node_modules', '.*']);
    });

    it('merges gitignore file rules when enabled', async () => {
        const dirUri = vscode.Uri.file('/workspace/project');
        vi.spyOn(FileSystemService, 'exists').mockResolvedValue(true);
        vi.spyOn(FileSystemService, 'readFile').mockResolvedValue('dist/\n# comment\nbuild/');

        const rules = await GitignoreService.loadRules(dirUri);
        expect(rules).toEqual(['node_modules', '.*', 'dist/', 'build/']);
    });

    it('skips gitignore file when respectGitignore is disabled', async () => {
        const dirUri = vscode.Uri.file('/workspace/project');
        mockConfigurationGet.mockImplementation((key: string, defaultValue?: unknown) => {
            if (key === 'respectGitignore') {
                return false;
            }
            if (key === 'ignorePatterns') {
                return ['node_modules'];
            }
            return defaultValue;
        });
        vi.spyOn(FileSystemService, 'readFile').mockResolvedValue('dist/');

        const rules = await GitignoreService.loadRules(dirUri);
        expect(rules).toEqual(['node_modules']);
        expect(FileSystemService.readFile).not.toHaveBeenCalled();
    });

    it('checks whether a relative path is ignored', () => {
        expect(GitignoreService.isIgnored('node_modules/pkg/index.js', ['node_modules'])).toBe(
            true,
        );
        expect(GitignoreService.isIgnored('src/index.ts', ['node_modules'])).toBe(false);
    });
});
