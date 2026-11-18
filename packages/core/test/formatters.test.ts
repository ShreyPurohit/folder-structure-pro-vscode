import { describe, expect, it } from 'vitest';
import { formatJson, formatPlainText, type FolderStructure } from '../src/index.js';

describe('formatters', () => {
    it('formats JSON structures', () => {
        const structure: FolderStructure = {
            project: {
                src: {
                    index: 'js',
                },
            },
        };
        expect(JSON.parse(formatJson(structure))).toEqual(structure);
    });

    it('formats plain text with multi-extension file leaves', () => {
        const structure: FolderStructure = {
            'user-service': {
                package: ['json', 'lock'],
                Dockerfile: null,
            },
            'docker-compose': 'yml',
        };

        const output = formatPlainText(structure);
        expect(output).toContain('Directory structure:');
        expect(output).toContain('├── user-service/');
        expect(output).toContain('├── package.json');
        expect(output).toContain('├── package.lock');
        expect(output).toContain('└── Dockerfile');
        expect(output).toContain('└── docker-compose.yml');
    });

    it('adds blank lines between multiple root directories', () => {
        const structure: FolderStructure = {
            'service-a': { index: 'ts' },
            'service-b': { index: 'js' },
        };

        const output = formatPlainText(structure);
        expect(output).toContain('service-a/');
        expect(output).toContain('\n\n');
        expect(output).toContain('service-b/');
    });

    it('does not add blank lines after empty directories', () => {
        const structure: FolderStructure = {
            docs: {
                archive: {},
                assets: {
                    diagrams: {},
                    icons: {},
                    images: {},
                },
                'meeting-notes': {},
                index: 'md',
            },
        };

        const output = formatPlainText(structure);
        expect(output).not.toMatch(/archive\/\n\s*\n/);
        expect(output).not.toMatch(/diagrams\/\n\s*\n/);
        expect(output).not.toMatch(/meeting-notes\/\n\s*\n/);
        expect(output).toContain('├── archive/');
        expect(output).toContain('├── assets/');
        expect(output).toContain('│   ├── diagrams/');
        expect(output).toContain('├── meeting-notes/');
        expect(output).toContain('└── index.md');
    });

    it('preserves exact plain-text output for nested and empty directories', () => {
        const structure: FolderStructure = {
            project: {
                src: { index: 'ts' },
                docs: {},
            },
        };

        expect(formatPlainText(structure)).toBe(
            'Directory structure:\n' +
                '└── project/\n' +
                '    ├── src/\n' +
                '    │   └── index.ts\n' +
                '    └── docs/',
        );
    });

    it('preserves exact spacing between multiple root directories', () => {
        const structure: FolderStructure = {
            'service-a': { index: 'ts' },
            'service-b': { index: 'js' },
        };

        expect(formatPlainText(structure)).toBe(
            'Directory structure:\n' +
                '├── service-a/\n' +
                '    └── index.ts\n\n' +
                '└── service-b/\n' +
                '    └── index.js',
        );
    });

    it('serializes JSON with the existing two-space indentation', () => {
        expect(formatJson({ project: { src: { index: 'ts' } } })).toBe(
            '{\n  "project": {\n    "src": {\n      "index": "ts"\n    }\n  }\n}',
        );
    });
});
