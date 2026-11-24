import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readStdinText } from '../src/adapters/stdin.js';

function streamOf(...chunks: Array<string | Buffer>) {
    const stream = new PassThrough();
    for (const chunk of chunks) {
        stream.write(chunk);
    }
    stream.end();
    return stream;
}

describe('readStdinText', () => {
    it('reads everything as UTF-8, even when a character is split between chunks', async () => {
        const bytes = Buffer.from('└── café/');
        const text = await readStdinText(streamOf(bytes.subarray(0, 2), bytes.subarray(2)));
        expect(text).toBe('└── café/');
    });

    it('returns an empty string for empty input', async () => {
        await expect(readStdinText(streamOf())).resolves.toBe('');
    });

    it('explains when nothing was piped in', async () => {
        const terminal = Object.assign(streamOf('typed'), { isTTY: true });
        await expect(readStdinText(terminal)).rejects.toThrow('Nothing was piped in.');
    });

    it('stops input that is far too large for a structure', async () => {
        await expect(readStdinText(streamOf('x'.repeat(2048)), 1024)).rejects.toThrow(
            'too large for a folder structure',
        );
    });
});
