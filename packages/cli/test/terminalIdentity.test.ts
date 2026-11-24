import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
    classifyDeviceAttributes,
    queryTerminalKind,
    type TerminalInput,
} from '../src/adapters/terminalIdentity.js';

describe('classifyDeviceAttributes', () => {
    it.each([
        ['GNOME Terminal over SSH (reported by a user)', '\u001b[>61;7600;1c', 'vte'],
        ['older VTE', '\u001b[>65;6003;1c', 'vte'],
        ['xterm.js in the Kiro terminal (reported by a user)', '\u001b[>0;276;0c', 'other'],
        ['xterm', '\u001b[>41;370;0c', 'other'],
        ['kitty', '\u001b[>1;4000;29c', 'other'],
        ['a 61 that is not VTE (wrong third value)', '\u001b[>61;7600;0c', 'other'],
        ['a 61 with a tiny version', '\u001b[>61;10;1c', 'other'],
    ] as const)('%s', (_name, reply, expected) => {
        expect(classifyDeviceAttributes(reply)).toBe(expected);
    });

    it('finds the reply inside other bytes and ignores unrelated input', () => {
        expect(classifyDeviceAttributes('xx\u001b[>61;7600;1cyy')).toBe('vte');
        expect(classifyDeviceAttributes('hello')).toBeUndefined();
        expect(classifyDeviceAttributes('\u001b[>61;7600;1')).toBeUndefined();
    });
});

class FakeInput extends EventEmitter {
    isTTY = true;
    isRaw = false;
    setRawMode = vi.fn((mode: boolean) => {
        this.isRaw = mode;
    });
    resume = vi.fn();
    pause = vi.fn();
}

const asInput = (input: FakeInput) => input as unknown as TerminalInput;

describe('queryTerminalKind', () => {
    it('sends the query in raw mode, reads the reply and restores the terminal', async () => {
        const input = new FakeInput();
        const write = vi.fn((data: string) => {
            expect(input.isRaw).toBe(true); // raw first, so the reply is never echoed
            queueMicrotask(() => input.emit('data', Buffer.from('\u001b[>61;7600;1c')));
            return true;
        });

        await expect(queryTerminalKind({ input: asInput(input), write })).resolves.toBe('vte');
        expect(write).toHaveBeenCalledWith('\u001b[>c');
        expect(input.isRaw).toBe(false);
        expect(input.pause).toHaveBeenCalled();
        expect(input.listenerCount('data')).toBe(0);
    });

    it('assembles a reply that arrives in pieces', async () => {
        const input = new FakeInput();
        const write = vi.fn(() => {
            queueMicrotask(() => {
                input.emit('data', '\u001b[>0;27');
                input.emit('data', '6;0c');
            });
            return true;
        });
        await expect(queryTerminalKind({ input: asInput(input), write })).resolves.toBe('other');
    });

    it('gives up quietly when the terminal never answers', async () => {
        const input = new FakeInput();
        const started = Date.now();
        await expect(
            queryTerminalKind({ input: asInput(input), write: () => true }, 150),
        ).resolves.toBeUndefined();
        expect(Date.now() - started).toBeLessThan(1000);
        expect(input.isRaw).toBe(false);
        expect(input.listenerCount('data')).toBe(0);
    });

    it('does nothing without an interactive terminal', async () => {
        const input = new FakeInput();
        input.isTTY = false;
        const write = vi.fn(() => true);
        await expect(queryTerminalKind({ input: asInput(input), write })).resolves.toBeUndefined();
        expect(write).not.toHaveBeenCalled();
        expect(input.setRawMode).not.toHaveBeenCalled();
    });

    it('restores the terminal when it cannot be written to', async () => {
        const input = new FakeInput();
        await expect(
            queryTerminalKind({ input: asInput(input), write: () => false }),
        ).resolves.toBeUndefined();
        expect(input.isRaw).toBe(false);
    });
});
