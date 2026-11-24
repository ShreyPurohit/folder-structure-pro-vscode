import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import {
    announceCliOnce,
    CLI_ANNOUNCEMENT,
    CLI_ANNOUNCEMENT_KEY,
    LAST_VERSION_KEY,
    showWhatsNew,
} from '../src/whatsNew';
import { activate } from '../src/extension';
import {
    mockFsStat,
    mockGetExtension,
    mockOpenExternal,
    resetVscodeMocks,
} from './__mocks__/vscode';

type Handler = (message: unknown) => Promise<void>;

/** An extension context with an in-memory global state, like VS Code's. */
function createContext(initial: Record<string, unknown> = {}) {
    const store = new Map(Object.entries(initial));
    const order: string[] = [];
    const globalState = {
        setKeysForSync: vi.fn((keys: readonly string[]) => order.push(`sync:${keys.join(',')}`)),
        get: vi.fn(<T>(key: string) => {
            order.push(`get:${key}`);
            return store.get(key) as T | undefined;
        }),
        update: vi.fn(async (key: string, value: unknown) => {
            order.push(`update:${key}`);
            store.set(key, value);
        }),
    };
    const context = {
        subscriptions: [],
        globalState,
        extensionUri: vscode.Uri.file('/ext'),
    } as unknown as vscode.ExtensionContext;
    return { context, store, order, globalState };
}

function mockPanel() {
    let handler: Handler | undefined;
    const panel = {
        webview: {
            html: '',
            cspSource: 'vscode-resource:',
            asWebviewUri: (uri: vscode.Uri) =>
                vscode.Uri.from({ scheme: 'vscode-resource', path: uri.path }),
            onDidReceiveMessage: vi.fn((callback: Handler) => {
                handler = callback;
                return { dispose: vi.fn() };
            }),
        },
    };
    vscode.window.createWebviewPanel.mockReturnValue(panel);
    return { panel, send: (message: unknown) => handler!(message) };
}

describe('CLI announcement', () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('shows once, with the two actions', async () => {
        const { context, store } = createContext();
        vscode.window.showInformationMessage.mockResolvedValueOnce(undefined);

        await announceCliOnce(context);
        await announceCliOnce(context);

        expect(vscode.window.showInformationMessage).toHaveBeenCalledOnce();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            CLI_ANNOUNCEMENT,
            "What's New",
            'Copy command',
        );
        expect(store.get(CLI_ANNOUNCEMENT_KEY)).toBe(true);
    });

    it('syncs the flag, registering it before reading it, and saves it before showing', async () => {
        const { context, order } = createContext();
        vscode.window.showInformationMessage.mockImplementationOnce(async () => {
            order.push('shown');
            return undefined;
        });
        await announceCliOnce(context);

        expect(order[0]).toBe(`sync:${CLI_ANNOUNCEMENT_KEY}`);
        expect(order.indexOf(`update:${CLI_ANNOUNCEMENT_KEY}`)).toBeLessThan(
            order.indexOf('shown'),
        );
    });

    it('stays quiet when already shown, for example on another synced machine', async () => {
        const { context } = createContext({ [CLI_ANNOUNCEMENT_KEY]: true });
        await announceCliOnce(context);
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('records the running version for later releases', async () => {
        const { context, store } = createContext({ [CLI_ANNOUNCEMENT_KEY]: true });
        await announceCliOnce(context);
        expect(mockGetExtension).toHaveBeenCalledWith('iamshreydxv.copy-folder-structure');
        expect(store.get(LAST_VERSION_KEY)).toBe('0.3.0');

        mockGetExtension.mockReturnValueOnce(undefined);
        const unknown = createContext({ [CLI_ANNOUNCEMENT_KEY]: true });
        await announceCliOnce(unknown.context);
        expect(unknown.store.has(LAST_VERSION_KEY)).toBe(false);
    });

    it('copies the command from the notification', async () => {
        const { context } = createContext();
        vscode.window.showInformationMessage.mockResolvedValueOnce('Copy command');
        await announceCliOnce(context);
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('npx folder-structure-pro');
        expect(vscode.window.showInformationMessage).toHaveBeenLastCalledWith(
            'Copied "npx folder-structure-pro". Paste it in any terminal.',
        );
    });

    it('reports a failed copy', async () => {
        const { context } = createContext();
        vscode.window.showInformationMessage.mockResolvedValueOnce('Copy command');
        vi.mocked(vscode.env.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
        await announceCliOnce(context);
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to copy the command');
    });

    it("opens the What's New page from the notification", async () => {
        const { context } = createContext();
        mockPanel();
        mockFsStat.mockRejectedValue(new Error('missing'));
        vscode.window.showInformationMessage.mockResolvedValueOnce("What's New");
        await announceCliOnce(context);
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledOnce();
    });

    it('never lets the announcement break activation', async () => {
        const { context, globalState } = createContext();
        globalState.update.mockRejectedValue(new Error('storage unavailable'));
        expect(() => activate(context)).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
});

describe("What's New page", () => {
    beforeEach(() => {
        resetVscodeMocks();
    });

    it('allows only its own images and a script with a fresh nonce', async () => {
        const { context } = createContext();
        const { panel } = mockPanel();
        mockFsStat.mockResolvedValue({ type: vscode.FileType.File });
        await showWhatsNew(context);

        const html = panel.webview.html;
        const nonce = /script-src 'nonce-([^']+)'/.exec(html)?.[1];
        expect(nonce).toBeTruthy();
        expect(html).toContain(`<script nonce="${nonce}">`);
        expect(html).toContain('img-src vscode-resource:;');
        expect(html).toContain("default-src 'none'");
        const script = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(html)![1];
        expect(() => new Function(script)).not.toThrow();
    });

    it('copies the command and opens the npm page, ignoring anything the page sends along', async () => {
        const { context } = createContext();
        const { send } = mockPanel();
        mockFsStat.mockRejectedValue(new Error('missing'));
        await showWhatsNew(context);

        await send({ command: 'copyCommand', text: 'rm -rf /' });
        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('npx folder-structure-pro');
        await send({ command: 'learnMore', url: 'https://example.com' });
        expect(mockOpenExternal).toHaveBeenCalledWith(
            vscode.Uri.parse('https://www.npmjs.com/package/folder-structure-pro'),
        );
        await send(undefined);
    });
});
