import { describe, expect, it } from 'vitest';
import {
    DEFAULT_OUTPUT_FORMAT,
    ERROR_MESSAGES,
    JSON_OUTPUT_FORMAT,
    PLAIN_TEXT_OUTPUT_FORMAT,
} from '../../src/constants';

describe('constants', () => {
    it('exports stable defaults and symbols', () => {
        expect(PLAIN_TEXT_OUTPUT_FORMAT).toBe('Plain Text Format');
        expect(JSON_OUTPUT_FORMAT).toBe('JSON Format');
        expect(DEFAULT_OUTPUT_FORMAT).toBe(PLAIN_TEXT_OUTPUT_FORMAT);
        expect(ERROR_MESSAGES.TARGET_REQUIRED).toBe('Target directory is required.');
    });
});
