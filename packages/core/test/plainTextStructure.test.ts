import { describe, expect, it } from 'vitest';
import { parsePlainTextToStructure, type FolderStructure } from '../src/index.js';

function getDirectory(structure: FolderStructure, name: string): FolderStructure {
    const value = structure[name];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Expected "${name}" to be a directory`);
    }
    return value;
}

describe('parsePlainTextToStructure', () => {
    it('parses an unindented tree with nested directories and multiple file extensions', () => {
        const result = parsePlainTextToStructure(`Directory structure:
└── app/
    ├── README
    ├── package.json
    ├── package.lock
    └── empty/`);

        expect(result.invalidLines).toEqual([]);
        expect(result.structure).toEqual({
            app: {
                README: 'file',
                package: ['json', 'lock'],
                empty: {},
            },
        });
    });

    it('supports multiple roots and decorative separator lines in provider order', () => {
        const result = parsePlainTextToStructure(`Directory structure:
├── user-service/
│   └── package.json
│
├── order-service/
│   └── package.json
└── docker-compose.yml`);

        expect(result.invalidLines).toEqual([]);
        expect(Object.keys(result.structure)).toEqual([
            'user-service',
            'order-service',
            'docker-compose',
        ]);
        expect(result.structure['docker-compose']).toBe('yml');
    });

    it('continues to ignore the first line even when it resembles a tree entry', () => {
        const result = parsePlainTextToStructure(`└── ignored.ts
└── kept.ts`);

        expect(result.invalidLines).toEqual([]);
        expect(result.structure).toEqual({ kept: 'ts' });
    });

    it('preserves an initial one-level indentation offset beneath the ignored header', () => {
        const result = parsePlainTextToStructure(`Project
    └── app/
        └── index.ts`);

        expect(result.invalidLines).toEqual([]);
        expect(result.structure).toEqual({ app: { index: 'ts' } });
    });

    it('ignores blank and repeated header lines before establishing the baseline', () => {
        const result = parsePlainTextToStructure(`Project

Directory structure:
    └── app/
        └── index.ts`);

        expect(result.invalidLines).toEqual([]);
        expect(result.structure).toEqual({ app: { index: 'ts' } });
    });

    it.each([
        { label: 'two levels', indentation: '        ' },
        { label: 'several levels', indentation: '                    ' },
    ])('rejects a first valid entry indented by $label', ({ indentation }) => {
        const result = parsePlainTextToStructure(
            `Project\n${indentation}└── invalid.ts\n└── kept.ts`,
        );

        expect(result.invalidLines).toEqual([2]);
        expect(result.structure).toEqual({ kept: 'ts' });
    });

    it('does not establish the baseline from an invalid connector line', () => {
        const result = parsePlainTextToStructure(`Project
    ├──
    └── app/
        └── index.ts`);

        expect(result.invalidLines).toEqual([2]);
        expect(result.structure).toEqual({ app: { index: 'ts' } });
    });

    it('rejects indentation gaps relative to the initial offset', () => {
        const result = parsePlainTextToStructure(`Project
    └── app/
            ├── skipped.ts
        └── index.ts`);

        expect(result.invalidLines).toEqual([3]);
        expect(result.structure).toEqual({ app: { index: 'ts' } });
    });

    it('reports indentation gaps and malformed connector lines', () => {
        const result = parsePlainTextToStructure(`Directory structure:
└── app/
        └── skipped-level.ts
│   │   │   └── deep.ts
├── `);

        expect(result.invalidLines).toEqual([3, 4, 5]);
    });

    it('preserves directory/file collisions and inline-comment behavior', () => {
        const result = parsePlainTextToStructure(`Directory structure:
└── my-app/
    ├── app/
    │   └── index.ts
    ├── app.json
    ├── commands/  # source commands
    │   └── file#name.ts`);

        expect(result.invalidLines).toEqual([]);
        const root = getDirectory(result.structure, 'my-app');
        expect(root.app).toEqual({ index: 'ts' });
        expect(root['app.json']).toBeNull();
        expect(getDirectory(root, 'commands')['file#name']).toBe('ts');
    });

    it('retains the documented truncation of space-prefixed comment markers in names', () => {
        const result = parsePlainTextToStructure(`Directory structure:
└── file #draft.ts`);

        expect(result.structure).toEqual({ file: 'file' });
    });

    it('safely parses prototype-named path components', () => {
        const result = parsePlainTextToStructure(`Directory structure:
└── __proto__/
    └── constructor.ts`);

        expect(Object.getPrototypeOf(result.structure)).toBeNull();
        expect(result.structure['__proto__']).toEqual({ constructor: 'ts' });
        expect(Object.prototype).not.toHaveProperty('constructor.ts');
    });
});
