import { describe, expect, it } from 'vitest';
import {
    detectStructureFormat,
    parseStructureInput,
    parsePlainTextToStructure,
    EMPTY_STRUCTURE_MESSAGE,
    INVALID_JSON_SHAPE_MESSAGE,
} from '../src/index.js';

const TREE = ['└── proj/', '    ├── README.md', '    └── src/', '        └── a.ts'];
const EXPECTED = { proj: { README: 'md', src: { a: 'ts' } } };

describe('detectStructureFormat', () => {
    it('picks JSON only when the text starts with a brace', () => {
        expect(detectStructureFormat('{"a":{}}')).toBe('json');
        expect(detectStructureFormat('  \n\uFEFF{ }')).toBe('json');
        expect(detectStructureFormat('Directory structure:\n└── a/')).toBe('text');
        expect(detectStructureFormat('')).toBe('text');
    });
});

describe('parseStructureInput (plain text)', () => {
    it('reads text with the heading exactly like the plain parser', () => {
        const text = ['Directory structure:', ...TREE].join('\n');
        const result = parseStructureInput(text);
        expect(result).toEqual({ ok: true, format: 'text', structure: EXPECTED });
        expect(result.ok && result.structure).toEqual(parsePlainTextToStructure(text).structure);
    });

    it('keeps the root folder when the heading is missing', () => {
        // The plain parser alone would treat the first line as the heading and drop "proj".
        expect(parsePlainTextToStructure(TREE.join('\n')).structure).not.toEqual(EXPECTED);
        expect(parseStructureInput(TREE.join('\n'))).toMatchObject({
            ok: true,
            structure: EXPECTED,
        });
    });

    it('accepts Windows line endings, a byte order mark and leading blank lines', () => {
        const text = `\uFEFF\r\n\r\nDirectory structure:\r\n${TREE.join('\r\n')}\r\n`;
        expect(parseStructureInput(text)).toMatchObject({ ok: true, structure: EXPECTED });
    });

    it('keeps a bare root line behaving as before: its children go straight in', () => {
        const text = ['proj/', '├── README.md', '└── src/', '    └── a.ts'].join('\n');
        expect(parseStructureInput(text)).toMatchObject({
            ok: true,
            structure: { README: 'md', src: { a: 'ts' } },
        });
    });

    it('reports invalid lines with the numbers and text the user wrote', () => {
        const text = ['Directory structure:', '└── proj/', '            └── too-deep.ts'].join(
            '\n',
        );
        expect(parseStructureInput(text)).toEqual({
            ok: false,
            format: 'text',
            message: 'Some lines could not be read.',
            invalidLines: [{ line: 3, text: '            └── too-deep.ts' }],
        });
    });

    it('reports line numbers correctly after a missing heading and leading blank lines', () => {
        const text = ['', '', '└── proj/', '            └── too-deep.ts'].join('\n');
        expect(parseStructureInput(text)).toMatchObject({
            ok: false,
            invalidLines: [{ line: 4, text: '            └── too-deep.ts' }],
        });
    });

    it.each(['', '   \n\n', 'Directory structure:', 'just some words'])(
        'rejects input with nothing to create (%j)',
        (text) => {
            expect(parseStructureInput(text)).toEqual({
                ok: false,
                format: 'text',
                message: EMPTY_STRUCTURE_MESSAGE,
                invalidLines: [],
            });
        },
    );

    it('passes parser options through', () => {
        const getFileType = (name: string) => `custom-${name.length}`;
        const result = parseStructureInput(TREE.join('\n'), { parserOptions: { getFileType } });
        expect(result.ok && JSON.stringify(result.structure)).toContain('custom-');
    });
});

describe('parseStructureInput (JSON)', () => {
    it('detects and reads JSON, including comments', () => {
        const text = '{\n  "proj": { # folder\n    "a": "ts"\n  }\n}';
        expect(parseStructureInput(text)).toEqual({
            ok: true,
            format: 'json',
            structure: { proj: { a: 'ts' } },
        });
    });

    it('honours an explicit format over detection', () => {
        expect(parseStructureInput('{"a":"ts"}', { format: 'text' })).toMatchObject({
            ok: false,
            format: 'text',
        });
        expect(
            parseStructureInput('Directory structure:\n└── a/', { format: 'json' }),
        ).toMatchObject({
            ok: false,
            format: 'json',
            message: expect.stringContaining('Invalid JSON'),
        });
    });

    it('explains broken JSON and wrong shapes', () => {
        expect(parseStructureInput('{"a": ')).toMatchObject({
            ok: false,
            message: expect.stringMatching(/^Invalid JSON: /),
        });
        expect(parseStructureInput('{"a": 5}')).toMatchObject({
            ok: false,
            message: INVALID_JSON_SHAPE_MESSAGE,
        });
        expect(parseStructureInput('{}')).toMatchObject({
            ok: false,
            message: EMPTY_STRUCTURE_MESSAGE,
        });
    });
});
