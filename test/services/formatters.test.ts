import { describe, expect, it } from 'vitest';
import { JsonFormatter } from '../../src/services/formatters/jsonFormatter';
import { PlainTextFormatter } from '../../src/services/formatters/plainTextFormatter';
import type { FolderStructure } from '../../src/types';

describe('formatters', () => {
    it('formats JSON structures', () => {
        const structure: FolderStructure = {
            project: {
                src: {
                    index: 'js',
                },
            },
        };
        const formatter = new JsonFormatter();
        expect(JSON.parse(formatter.format(structure))).toEqual(structure);
    });

    it('formats plain text with multi-extension file leaves', () => {
        const structure: FolderStructure = {
            'user-service': {
                package: ['json', 'lock'],
                Dockerfile: null,
            },
            'docker-compose': 'yml',
        };

        const output = new PlainTextFormatter().format(structure);
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

        const output = new PlainTextFormatter().format(structure);
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

        const output = new PlainTextFormatter().format(structure);
        expect(output).not.toMatch(/archive\/\n\s*\n/);
        expect(output).not.toMatch(/diagrams\/\n\s*\n/);
        expect(output).not.toMatch(/meeting-notes\/\n\s*\n/);
        expect(output).toContain('├── archive/');
        expect(output).toContain('├── assets/');
        expect(output).toContain('│   ├── diagrams/');
        expect(output).toContain('├── meeting-notes/');
        expect(output).toContain('└── index.md');
    });
});
