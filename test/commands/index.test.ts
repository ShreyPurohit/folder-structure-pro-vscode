import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { registerCommands } from '../../src/commands';
import { activate, deactivate } from '../../src/extension';
import { resetVscodeMocks } from '../__mocks__/vscode';

describe('registerCommands', () => {
    it('registers all extension commands', () => {
        resetVscodeMocks();
        const push = vi.fn();
        const context = { subscriptions: { push } } as unknown as vscode.ExtensionContext;

        registerCommands(context);

        expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(6);
        expect(push).toHaveBeenCalledTimes(1);
        expect(push.mock.calls[0]).toHaveLength(6);
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            'extension.showWhatsNew',
            expect.any(Function),
        );
    });
});

describe('extension entrypoint', () => {
    it('activates and registers commands', () => {
        resetVscodeMocks();
        const push = vi.fn();
        const context = {
            subscriptions: { push },
            globalState: { setKeysForSync: vi.fn(), get: () => true, update: vi.fn() },
        } as unknown as vscode.ExtensionContext;

        activate(context);

        expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(6);
        expect(push).toHaveBeenCalledTimes(1);
    });

    it('deactivates without throwing', () => {
        expect(() => deactivate()).not.toThrow();
    });
});
