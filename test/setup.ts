import { vi } from 'vitest';

vi.stubGlobal('acquireVsCodeApi', () => ({
    postMessage: vi.fn(),
}));
