import { describe, expect, it } from 'vitest';
import { TreeParser } from '../../src/utils/parser';

describe('TreeParser', () => {
    it('returns null for empty or header lines', () => {
        expect(TreeParser.parseLine('')).toBeNull();
        expect(TreeParser.parseLine('   ')).toBeNull();
        expect(TreeParser.parseLine('Directory structure:')).toBeNull();
    });

    it('parses root directory and file lines', () => {
        expect(TreeParser.parseLine('├── user-service/')).toEqual({
            name: 'user-service',
            level: 0,
            isDirectory: true,
        });
        expect(TreeParser.parseLine('└── docker-compose.yml')).toEqual({
            name: 'docker-compose.yml',
            level: 0,
            isDirectory: false,
        });
    });

    it('parses nested entries with indentation', () => {
        expect(TreeParser.parseLine('│   ├── src/')).toEqual({
            name: 'src',
            level: 1,
            isDirectory: true,
        });
        expect(TreeParser.parseLine('    └── index.ts')).toEqual({
            name: 'index.ts',
            level: 1,
            isDirectory: false,
        });
    });

    it('supports ASCII connectors', () => {
        expect(TreeParser.parseLine('|-- legacy.ts')).toEqual({
            name: 'legacy.ts',
            level: 0,
            isDirectory: false,
        });
        expect(TreeParser.parseLine('`-- old.ts')).toEqual({
            name: 'old.ts',
            level: 0,
            isDirectory: false,
        });
    });

    it('returns null when connector is missing', () => {
        expect(TreeParser.parseLine('│')).toBeNull();
        expect(TreeParser.parseLine('just-a-name.ts')).toBeNull();
    });

    it('strips # inline comments from directory lines', () => {
        expect(TreeParser.parseLine('├── commands/  # Used for commands')).toEqual({
            name: 'commands',
            level: 0,
            isDirectory: true,
        });
    });

    it('strips // inline comments from file lines', () => {
        expect(TreeParser.parseLine('└── index.ts // entry point')).toEqual({
            name: 'index.ts',
            level: 0,
            isDirectory: false,
        });
    });

    it('does not strip # that is part of the name (no leading space)', () => {
        expect(TreeParser.parseLine('└── C#-project/')).toEqual({
            name: 'C#-project',
            level: 0,
            isDirectory: true,
        });
    });

    it('does not strip # at the start of the name', () => {
        expect(TreeParser.parseLine('└── #changelog')).toEqual({
            name: '#changelog',
            level: 0,
            isDirectory: false,
        });
    });
});
