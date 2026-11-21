import { describe, expect, it } from 'vitest';
import { parseJsonWithComments, stripInlineComments, validateJsonStructure } from '../src/index.js';

describe('JSON parsing and structure validation', () => {
    it('strips trailing hash and slash comments outside quoted strings', () => {
        const source = '{\n  "app": { # folder\n    "index": "ts" // entry\n  }\n}';

        expect(stripInlineComments(source)).toBe('{\n  "app": {\n    "index": "ts"\n  }\n}');
        expect(parseJsonWithComments(source)).toEqual({ app: { index: 'ts' } });
    });

    it('preserves comment markers inside quoted strings', () => {
        const source = `{
  "notes": "Remember #important items",
  "path": "src/http//client.ts"
}`;

        expect(parseJsonWithComments(source)).toEqual({
            notes: 'Remember #important items',
            path: 'src/http//client.ts',
        });
    });

    it('handles escaped quotes and backslashes before stripping trailing comments', () => {
        const source =
            '{\n  "msg": "He said \\"hello\\"", // comment\n  "path": "C:\\\\Users\\\\file.ts" # comment\n}';
        const cleaned = stripInlineComments(source);

        expect(() => JSON.parse(cleaned)).not.toThrow();
        expect(parseJsonWithComments(source)).toEqual({
            msg: 'He said "hello"',
            path: 'C:\\Users\\file.ts',
        });
        expect(cleaned).not.toContain('// comment');
        expect(cleaned).not.toContain('# comment');
    });

    it('strips a marker only when it is preceded by whitespace', () => {
        expect(stripInlineComments('{"name":"file#draft.ts"}')).toBe('{"name":"file#draft.ts"}');
        expect(stripInlineComments('{"url":"http://example.test"}')).toBe(
            '{"url":"http://example.test"}',
        );
        expect(stripInlineComments('  "index": "ts" // entry')).toBe('  "index": "ts"');
    });

    it('preserves JSON syntax errors as distinct parse failures', () => {
        expect(() => parseJsonWithComments('{ invalid')).toThrow(SyntaxError);
    });

    it('validates existing nested object, leaf, and extension-array forms', () => {
        expect(
            validateJsonStructure({
                app: {
                    package: ['json', 'lock'],
                    Dockerfile: null,
                },
            }),
        ).toBe(true);
        expect(validateJsonStructure({})).toBe(true);
        expect(validateJsonStructure({ app: {} })).toBe(true);
    });

    it('rejects invalid structure shapes without conflating them with JSON syntax errors', () => {
        const invalidValues: unknown[] = [
            null,
            [],
            'app',
            { app: [] },
            { app: ['json', 1] },
            { app: { nested: 123 } },
        ];

        for (const value of invalidValues) {
            expect(validateJsonStructure(value)).toBe(false);
        }

        const parsed = parseJsonWithComments('{"app":[]}');
        expect(validateJsonStructure(parsed)).toBe(false);
    });

    it('preserves acceptance of null values in file-extension arrays', () => {
        expect(validateJsonStructure({ app: ['ts', null] })).toBe(true);
    });
});
