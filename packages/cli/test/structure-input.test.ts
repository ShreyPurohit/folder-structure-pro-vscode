import { parseStructureInput } from '@folder-structure-pro/core';
import { describe, expect, it } from 'vitest';
import {
    buildEditorText,
    formatStructureProblem,
    parseStructureOrThrow,
    stripEditorComments,
    type InvalidStructure,
} from '../src/structure-input.js';

const problem = (lines: Array<[number, string]>, message = 'Some lines could not be read.') =>
    ({
        ok: false,
        format: 'text',
        message,
        invalidLines: lines.map(([line, text]) => ({ line, text })),
    }) as InvalidStructure;

describe('formatStructureProblem', () => {
    it('lists the line numbers and the offending text', () => {
        expect(formatStructureProblem(problem([[3, '      └── too-deep.ts']]))).toBe(
            'Invalid plain-text structure lines: 3.\n- line 3: └── too-deep.ts',
        );
    });

    it('shows the first five lines and counts the rest', () => {
        const lines: Array<[number, string]> = [2, 3, 4, 5, 6, 7, 8].map((n) => [n, `bad ${n}`]);
        const text = formatStructureProblem(problem(lines));
        expect(text).toContain('Invalid plain-text structure lines: 2, 3, 4, 5, 6, 7, 8.');
        expect(text).toContain('- line 6: bad 6');
        expect(text).not.toContain('bad 7');
        expect(text).toContain('- and 2 more');
    });

    it('uses the message when there are no line numbers (JSON, empty input)', () => {
        expect(formatStructureProblem(problem([], 'Invalid JSON: nope'))).toBe(
            'Invalid JSON: nope',
        );
    });
});

describe('parseStructureOrThrow', () => {
    it('returns the structure, or explains that nothing was created', () => {
        expect(parseStructureOrThrow('{"a":{"b":"ts"}}')).toEqual({ a: { b: 'ts' } });
        expect(() =>
            parseStructureOrThrow('Directory structure:\n└── a/\n          └── b.ts'),
        ).toThrow(
            /Invalid plain-text structure lines: 3\.\n- line 3: └── b\.ts\nNo files or directories were created\./,
        );
        expect(() => parseStructureOrThrow('{"a": 1}', 'json')).toThrow(
            'JSON structure must be nested objects',
        );
    });

    it('honours an explicit format', () => {
        expect(() => parseStructureOrThrow('{"a":{"b":"ts"}}', 'text')).toThrow(
            'Empty input or no valid lines.',
        );
    });
});

describe('editor text', () => {
    const tree = 'Directory structure:\n└── proj/\n    └── src/';

    it('opens with an empty first line for the paste, then the instructions', () => {
        const text = buildEditorText('', { instructions: 'Save with Ctrl+O.' });
        expect(text.split('\n').slice(0, 5)).toEqual([
            '',
            '',
            '# Paste your structure above: a tree like the one this tool copies, or JSON.',
            '# Save with Ctrl+O.',
            '# Lines that start with "# " are ignored.',
        ]);
    });

    it('keeps the structure first, so editor line numbers match the error messages', () => {
        const text = buildEditorText(tree, { problem: problem([[3, '      └── x.ts']]) });
        expect(text.startsWith(`${tree}\n\n# Paste`)).toBe(true);
        expect(text).toContain('# These lines could not be read:');
        expect(text).toContain('#   line 3: └── x.ts');
        expect(buildEditorText('', { problem: problem([], 'Invalid JSON: nope') })).toContain(
            '#   Invalid JSON: nope',
        );
    });

    it('does not glue a paste that has no final newline to the instructions', () => {
        // The cursor starts on the empty first line, so a paste lands there.
        const opened = buildEditorText('');
        const pasted = `${tree}${opened}`; // what the editor holds after pasting at the very top
        expect(parseStructureInput(stripEditorComments(pasted))).toMatchObject({
            ok: true,
            structure: { proj: { src: {} } },
        });
    });

    it('removes exactly the comments, so the structure reads the same as before', () => {
        for (const structure of [tree, '{\n  "proj": { "a": "ts" }\n}']) {
            const withComments = buildEditorText(structure, {
                instructions: 'Save and close.',
                problem: problem([[2, 'x']]),
            });
            expect(parseStructureInput(stripEditorComments(withComments))).toEqual(
                parseStructureInput(structure),
            );
        }
    });

    it('keeps tree lines that merely contain a hash, and handles Windows line endings', () => {
        const text = '# note\r\n└── #changelog\r\n    ├── # odd.md\r\n#\r\n#tag/\r\n';
        expect(stripEditorComments(text)).toBe('└── #changelog\n    ├── # odd.md\n#tag/\n');
    });
});
