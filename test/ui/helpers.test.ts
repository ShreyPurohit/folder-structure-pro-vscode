import { describe, expect, it } from 'vitest';
import { getExample, getScripts, getStyles } from '../../src/ui/helpers';

describe('ui helpers', () => {
    it('returns plain text and JSON examples', () => {
        expect(getExample('Plain Text Format')).toContain('Directory structure:');
        expect(getExample('JSON Format')).toContain('"project"');
    });

    it('returns non-empty styles and scripts', () => {
        expect(getStyles()).toContain(':root');
        expect(getScripts('Plain Text Format')).toContain('acquireVsCodeApi');
        expect(getScripts('JSON Format')).toContain('validationResult');
    });
});
