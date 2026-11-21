import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitignoreService } from '../../src/services/gitignore';
import { resetVscodeMocks, mockConfigurationGet } from '../__mocks__/vscode';

describe('GitignoreService', () => {
    beforeEach(() => {
        resetVscodeMocks();
        vi.restoreAllMocks();
    });

    it('reads default traversal filters from configuration', () => {
        expect(GitignoreService.getTraversalOptions()).toEqual({
            ignorePatterns: ['node_modules', '.*'],
            respectGitignore: true,
        });
    });

    it('returns configured traversal filters without reading filesystem content', () => {
        mockConfigurationGet.mockImplementation((key: string, defaultValue?: unknown) => {
            if (key === 'respectGitignore') {
                return false;
            }
            if (key === 'ignorePatterns') {
                return ['dist'];
            }
            return defaultValue;
        });

        expect(GitignoreService.getTraversalOptions()).toEqual({
            ignorePatterns: ['dist'],
            respectGitignore: false,
        });
    });

    it('uses the configuration defaults when settings are absent', () => {
        mockConfigurationGet.mockImplementation((key: string, defaultValue?: unknown) => {
            return defaultValue;
        });

        expect(GitignoreService.getTraversalOptions()).toEqual({
            ignorePatterns: ['node_modules', '.*'],
            respectGitignore: true,
        });
    });
});
