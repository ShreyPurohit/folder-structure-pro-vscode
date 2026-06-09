import { describe, expect, it } from 'vitest';
import {
    DEFAULT_ENCODING,
    DEFAULT_OUTPUT_FORMAT,
    ERROR_MESSAGES,
    TREE_SYMBOLS,
} from '../../src/constants';

describe('constants', () => {
    it('exports stable defaults and symbols', () => {
        expect(DEFAULT_OUTPUT_FORMAT).toBe('Plain Text Format');
        expect(DEFAULT_ENCODING).toBe('utf-8');
        expect(TREE_SYMBOLS.BRANCH).toBe('├── ');
        expect(ERROR_MESSAGES.TARGET_REQUIRED).toBe('Target directory is required.');
    });
});
