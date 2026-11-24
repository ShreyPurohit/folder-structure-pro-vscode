import { describe, expect, it } from 'vitest';
import { CliArgumentError, parseCliArguments } from '../src/arguments.js';

describe('CLI arguments', () => {
    it('uses the interactive mode only when no arguments are supplied', () => {
        expect(parseCliArguments([])).toEqual({ kind: 'interactive' });
        expect(parseCliArguments(['--help'])).toEqual({ kind: 'help' });
        expect(parseCliArguments(['copy', '--help'])).toEqual({
            kind: 'help',
            command: 'copy',
        });
    });

    it('parses copy options and defaults', () => {
        expect(
            parseCliArguments([
                'copy',
                'project',
                '--format',
                'json',
                '--depth',
                '2',
                '--exclude',
                'dist',
                '--exclude',
                'coverage',
                '--hidden',
                '--no-gitignore',
            ]),
        ).toEqual({
            kind: 'copy',
            options: {
                directory: 'project',
                format: 'json',
                maxDepth: 2,
                ignorePatterns: ['dist', 'coverage'],
                includeHidden: true,
                respectGitignore: false,
            },
        });
        expect(parseCliArguments(['copy'])).toEqual({
            kind: 'copy',
            options: {
                directory: '.',
                format: 'text',
                maxDepth: undefined,
                ignorePatterns: [],
                includeHidden: false,
                respectGitignore: true,
            },
        });
    });

    it('treats a dash-prefixed copy directory as positional after --', () => {
        expect(parseCliArguments(['copy', '--', '-directory'])).toMatchObject({
            kind: 'copy',
            options: { directory: '-directory' },
        });
    });

    it('requires export options before -- and accepts a dash-prefixed directory afterward', () => {
        expect(() =>
            parseCliArguments(['export', '--', '-directory', '--output', 'structure.txt']),
        ).toThrow('at most one directory');

        expect(
            parseCliArguments(['export', '--output', 'structure.txt', '--', '-directory']),
        ).toMatchObject({
            kind: 'export',
            output: 'structure.txt',
            options: { directory: '-directory' },
        });
    });

    it('rejects extra positional arguments after --', () => {
        expect(() => parseCliArguments(['copy', '--', '-directory', 'another-directory'])).toThrow(
            'at most one directory',
        );
    });

    it('continues to parse command options placed before --', () => {
        expect(
            parseCliArguments(['copy', '--format', 'json', '--depth', '2', '--', '-directory']),
        ).toMatchObject({
            kind: 'copy',
            options: {
                directory: '-directory',
                format: 'json',
                maxDepth: 2,
            },
        });
    });

    it('requires an export destination and records explicit overwrite approval', () => {
        expect(parseCliArguments(['export', '--output', '-', '--force', 'project'])).toMatchObject({
            kind: 'export',
            output: '-',
            force: true,
            options: { directory: 'project' },
        });
        expect(() => parseCliArguments(['export'])).toThrow(
            new CliArgumentError('Option --output requires a value.'),
        );
    });

    it('requires explicit create format and non-interactive confirmation', () => {
        expect(
            parseCliArguments([
                'create',
                'structure.json',
                '--format',
                'json',
                '--to',
                'target',
                '--yes',
                '--on-conflict',
                'replace',
            ]),
        ).toEqual({
            kind: 'create',
            structureFile: 'structure.json',
            format: 'json',
            destination: 'target',
            onConflict: 'replace',
        });
        expect(() => parseCliArguments(['create', 'structure.txt', '--format', 'text'])).toThrow(
            '--yes',
        );
        expect(() =>
            parseCliArguments([
                'create',
                'structure.txt',
                '--format',
                'text',
                '--yes',
                '--on-conflict',
                'overwrite',
            ]),
        ).toThrow('--on-conflict must be fail, skip, or replace.');
        expect(
            parseCliArguments(['create', 'structure.txt', '--format', 'text', '--yes']),
        ).toMatchObject({ onConflict: 'fail' });
    });

    it('detects the create format when --format is omitted, and accepts - for standard input', () => {
        expect(parseCliArguments(['create', 'structure.txt', '--yes'])).toEqual({
            kind: 'create',
            structureFile: 'structure.txt',
            format: undefined,
            destination: '.',
            onConflict: 'fail',
        });
        expect(parseCliArguments(['create', '-', '--to', 'out', '--yes'])).toMatchObject({
            kind: 'create',
            structureFile: '-',
            format: undefined,
            destination: 'out',
        });
        expect(() => parseCliArguments(['create', 'a.txt', '--format', 'xml', '--yes'])).toThrow(
            'Option --format must be either text or json.',
        );
    });

    it('rejects invalid command-specific options, values, and extra positionals', () => {
        expect(() => parseCliArguments(['copy', '--output', 'file.txt'])).toThrow(
            'not valid for this command',
        );
        expect(() => parseCliArguments(['export', 'one', 'two', '--output', 'file.txt'])).toThrow(
            'at most one directory',
        );
        expect(() => parseCliArguments(['copy', '--depth', '-1'])).toThrow();
        expect(() => parseCliArguments(['unknown'])).toThrow('Unknown command');
        expect(() => parseCliArguments(['--format', 'text'])).toThrow('command is required');
    });
});
