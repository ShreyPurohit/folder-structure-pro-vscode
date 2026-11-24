import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { createStructure } from '../../src/commands/createStructure';
import {
    cancelProgress,
    mockFsDelete,
    mockFsRename,
    mockOpenExternal,
    resetVscodeMocks,
} from '../__mocks__/vscode';
import { installMemoryWorkspaceFs } from '../helpers/memoryWorkspaceFs';

type MessageHandler = (message: Record<string, unknown>) => Promise<void>;

const TARGET = '/workspace/target';
const VALID_TREE = 'Directory structure:\n└── app/\n    └── index.ts';
const INVALID_TREE = 'Directory structure:\n└── app/\n            └── too-deep.ts';

function createPanelMock() {
    let messageHandler: MessageHandler | undefined;
    const postMessage = vi.fn();
    const dispose = vi.fn();
    const panel = {
        webview: {
            html: '',
            postMessage,
            onDidReceiveMessage: vi.fn((handler: MessageHandler) => {
                messageHandler = handler;
                return { dispose: vi.fn() };
            }),
        },
        dispose,
    };
    vscode.window.createWebviewPanel.mockReturnValue(panel);
    return {
        postMessage,
        dispose,
        async send(message: Record<string, unknown>) {
            if (!messageHandler) {
                throw new Error('Message handler not registered');
            }
            await messageHandler(message);
        },
    };
}

/** Opens the Create command on TARGET, with an in-memory workspace. */
async function openPanel(files: Record<string, string | null> = {}) {
    const fs = installMemoryWorkspaceFs({ [TARGET]: null, ...files });
    vscode.window.showOpenDialog.mockResolvedValueOnce([vscode.Uri.file(TARGET)]);
    const panel = createPanelMock();
    await createStructure();
    return { fs, panel };
}

const submit = (text: string, format = 'Plain Text Format') => ({
    command: 'submit',
    text,
    format,
});

describe('createStructure command', () => {
    beforeEach(() => {
        resetVscodeMocks();
        vi.restoreAllMocks();
    });

    it('shows an error when target folder selection is cancelled', async () => {
        vscode.window.showOpenDialog.mockResolvedValueOnce(undefined);
        await createStructure();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Target directory is required'),
        );
    });

    describe('validation as you type', () => {
        it('accepts a valid tree and previews it', async () => {
            const { panel } = await openPanel();
            await panel.send({
                command: 'validate',
                format: 'Plain Text Format',
                text: VALID_TREE,
            });
            expect(panel.postMessage).toHaveBeenCalledWith({
                command: 'validationResult',
                valid: true,
                invalidLines: [],
                problems: [],
                counts: { folders: 1, files: 1 },
                preview: expect.stringContaining('index.ts'),
            });
        });

        it('names the lines that cannot be read', async () => {
            const { panel } = await openPanel();
            await panel.send({
                command: 'validate',
                format: 'Plain Text Format',
                text: INVALID_TREE,
            });
            expect(panel.postMessage).toHaveBeenCalledWith({
                command: 'validationResult',
                valid: false,
                invalidLines: [3],
                problems: [{ line: 3, text: '            └── too-deep.ts' }],
                preview: '',
                errorMessage: undefined,
            });
        });

        it.each([
            ['invalid JSON', 'JSON Format', '{ invalid', /^Invalid JSON: /],
            [
                'empty plain text',
                'Plain Text Format',
                'not a tree',
                /^Empty input or no valid lines\.$/,
            ],
            [
                'a JSON value that is not a structure',
                'JSON Format',
                '{"app": 5}',
                /must be nested objects/,
            ],
        ])('reports %s', async (_label, format, text, expected) => {
            const { panel } = await openPanel();
            await panel.send({ command: 'validate', format, text });
            expect(panel.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'validationResult',
                    valid: false,
                    errorMessage: expect.stringMatching(expected),
                }),
            );
        });
    });

    describe('Create Structure', () => {
        it('creates the structure with the shared core and closes the panel', async () => {
            const { fs, panel } = await openPanel();
            await panel.send(submit(JSON.stringify({ app: { index: 'ts' } }), 'JSON Format'));

            expect(fs.read(`${TARGET}/app/index.ts`)).toBe('');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Created 1 folder and 1 file.',
            );
            expect(panel.dispose).toHaveBeenCalled();
        });

        it('refuses an invalid structure and creates nothing', async () => {
            const { fs, panel } = await openPanel();
            const before = fs.snapshot();
            await panel.send(submit(INVALID_TREE));

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Nothing was created. 1 line could not be read: Line 3: └── too-deep.ts',
            );
            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
            expect(fs.snapshot()).toEqual(before);
            expect(panel.dispose).not.toHaveBeenCalled();
        });

        it('refuses names that would leave the chosen folder', async () => {
            const { fs, panel } = await openPanel({ '/workspace/outside': null });
            const before = fs.snapshot();
            await panel.send(
                submit(JSON.stringify({ '../outside': { evil: 'ts' } }), 'JSON Format'),
            );

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringMatching(/^Nothing was created\. ".\.\/outside" is not a safe/),
            );
            expect(fs.snapshot()).toEqual(before);
        });

        it('explains a destination that disappeared after it was chosen', async () => {
            const { fs, panel } = await openPanel();
            fs.nodes.delete(TARGET);
            await panel.send(submit(VALID_TREE));
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringMatching(/\(NOT_FOUND\)$/),
            );
        });

        it('reports an unexpected failure as it is', async () => {
            const { panel } = await openPanel();
            mockFsRename.mockImplementationOnce(async () => {
                // eslint-disable-next-line no-throw-literal -- a provider may reject with a non-Error value
                throw 'not an Error object';
            });
            await panel.send(submit(VALID_TREE));
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Nothing was changed'),
            );
        });

        it('reuses existing folders without asking', async () => {
            const { fs, panel } = await openPanel({ [`${TARGET}/app/own.txt`]: 'mine' });
            await panel.send(submit(VALID_TREE));

            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
            expect(fs.read(`${TARGET}/app/index.ts`)).toBe('');
            expect(fs.read(`${TARGET}/app/own.txt`)).toBe('mine');
        });
    });

    describe('existing files', () => {
        const EXISTING = { [`${TARGET}/app/index.ts`]: 'old', [`${TARGET}/app/keep.md`]: 'mine' };

        it('asks once, naming the files that already exist', async () => {
            const { panel } = await openPanel(EXISTING);
            vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
            await panel.send(submit(VALID_TREE));

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                '1 file already exists: app/index.ts. Replace empties them and moves their old versions to the Trash. Skip keeps them as they are.',
                { modal: true },
                'Replace',
                'Skip',
            );
        });

        it('replaces conflicting files only, and moves their old versions to the Trash', async () => {
            const { fs, panel } = await openPanel(EXISTING);
            vscode.window.showWarningMessage.mockResolvedValueOnce('Replace');
            await panel.send(submit(VALID_TREE));

            expect(fs.read(`${TARGET}/app/index.ts`)).toBe('');
            expect(fs.read(`${TARGET}/app/keep.md`)).toBe('mine');
            expect(fs.trashed).toEqual([
                expect.stringMatching(/\.index\.ts\..*\.folder-structure-pro$/),
            ]);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Created 0 folders and 0 files, replaced 1 file.',
            );
        });

        it('skips conflicting files and keeps their content', async () => {
            const { fs, panel } = await openPanel(EXISTING);
            vscode.window.showWarningMessage.mockResolvedValueOnce('Skip');
            await panel.send(submit(VALID_TREE));

            expect(fs.read(`${TARGET}/app/index.ts`)).toBe('old');
            expect(fs.trashed).toEqual([]);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                'Created 0 folders and 0 files, kept 1 existing file.',
            );
        });

        it('changes nothing when the dialog is dismissed', async () => {
            const { fs, panel } = await openPanel(EXISTING);
            const before = fs.snapshot();
            vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
            await panel.send(submit(VALID_TREE));

            expect(fs.snapshot()).toEqual(before);
            expect(panel.dispose).not.toHaveBeenCalled();
        });

        it('lists the first five conflicts and counts the rest', async () => {
            const files = Object.fromEntries(
                Array.from({ length: 7 }, (_, index) => [`${TARGET}/f${index}.ts`, 'x']),
            );
            const { panel } = await openPanel(files);
            vscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
            const tree = [
                'Directory structure:',
                ...Object.keys(files).map((path) => `├── ${path.slice(TARGET.length + 1)}`),
            ].join('\n');
            await panel.send(submit(tree));

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining(
                    '7 files already exist: f0.ts, f1.ts, f2.ts, f3.ts, f4.ts and 2 more.',
                ),
                expect.anything(),
                'Replace',
                'Skip',
            );
        });

        it('warns when a replaced original could not be moved to the Trash', async () => {
            const { fs, panel } = await openPanel(EXISTING);
            vscode.window.showWarningMessage.mockResolvedValueOnce('Replace');
            const realDelete = mockFsDelete.getMockImplementation()!;
            mockFsDelete.mockImplementation(async (uri, options) => {
                if (options?.useTrash) {
                    throw Object.assign(new Error('no trash'), { code: 'Unavailable' });
                }
                return realDelete(uri, options);
            });
            await panel.send(submit(VALID_TREE));

            expect(fs.read(`${TARGET}/app/index.ts`)).toBe('');
            expect(vscode.window.showWarningMessage).toHaveBeenLastCalledWith(
                expect.stringMatching(
                    /^Copies of the replaced files could not be moved to the Trash: app\/\.index\.ts\./,
                ),
            );
        });
    });

    describe('all or nothing', () => {
        const BIG = JSON.stringify({ app: { a: 'ts', b: 'ts', c: 'ts', d: 'ts' } });

        it('leaves the folder exactly as it was when a step fails', async () => {
            const { fs, panel } = await openPanel({ [`${TARGET}/existing.txt`]: 'old' });
            const before = fs.snapshot();
            let renames = 0;
            const realRename = mockFsRename.getMockImplementation()!;
            mockFsRename.mockImplementation(async (...args) => {
                if (++renames === 3) {
                    throw Object.assign(new Error('disk full'), { code: 'Unavailable' });
                }
                return realRename(...args);
            });
            await panel.send(submit(BIG, 'JSON Format'));

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Creation stopped at "app/c.ts". Nothing was changed: everything this run created was removed, and replaced files were restored. Cause: disk full',
            );
            expect(fs.snapshot()).toEqual(before);
            expect(panel.dispose).not.toHaveBeenCalled();
        });

        it('undoes everything when Cancel is pressed during creation', async () => {
            const { fs, panel } = await openPanel();
            const before = fs.snapshot();
            const realRename = mockFsRename.getMockImplementation()!;
            mockFsRename.mockImplementation(async (...args) => {
                await realRename(...args);
                cancelProgress(); // the user presses Cancel after the first file
            });
            await panel.send(submit(BIG, 'JSON Format'));

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Creation was cancelled. Nothing was changed: everything this run created was removed, and replaced files were restored.',
            );
            expect(fs.snapshot()).toEqual(before);
        });

        it('shows progress with a Cancel button', async () => {
            const { panel } = await openPanel();
            const withProgress = vi.spyOn(vscode.window, 'withProgress');
            await panel.send(submit(VALID_TREE));
            expect(withProgress).toHaveBeenCalledWith(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Creating folder structure',
                    cancellable: true,
                },
                expect.any(Function),
            );
        });
    });

    describe('counts', () => {
        it('counts every file a JSON leaf describes', async () => {
            const { panel } = await openPanel();
            await panel.send({
                command: 'validate',
                format: 'JSON Format',
                text: JSON.stringify({ app: { package: ['json', 'lock'], lib: { index: 'ts' } } }),
            });
            expect(panel.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ counts: { folders: 2, files: 3 } }),
            );
        });
    });

    describe('destination', () => {
        it('shows the chosen folder in the panel', async () => {
            await openPanel();
            expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
            const html = vscode.window.createWebviewPanel.mock.results[0].value.webview
                .html as string;
            expect(html).toContain(TARGET);
            expect(html).toContain('data-name="target"');
        });

        it('changes the folder from the panel and creates there', async () => {
            const { fs, panel } = await openPanel({ '/workspace/other': null });
            vscode.window.showOpenDialog.mockResolvedValueOnce([
                vscode.Uri.file('/workspace/other'),
            ]);
            await panel.send({ command: 'changeDestination' });

            expect(vscode.window.showOpenDialog).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    defaultUri: vscode.Uri.file(TARGET),
                    canSelectFolders: true,
                }),
            );
            expect(panel.postMessage).toHaveBeenCalledWith({
                command: 'destination',
                path: '/workspace/other',
                name: 'other',
            });
            await panel.send(submit(VALID_TREE));
            expect(fs.read('/workspace/other/app/index.ts')).toBe('');
            expect(fs.nodes.has(`${TARGET}/app`)).toBe(false);
        });

        it('keeps the folder when the picker is dismissed', async () => {
            const { fs, panel } = await openPanel();
            vscode.window.showOpenDialog.mockResolvedValueOnce(undefined);
            await panel.send({ command: 'changeDestination' });
            expect(panel.postMessage).not.toHaveBeenCalledWith(
                expect.objectContaining({ command: 'destination' }),
            );
            await panel.send(submit(VALID_TREE));
            expect(fs.read(`${TARGET}/app/index.ts`)).toBe('');
        });
    });

    describe('CLI strip', () => {
        it('copies the CLI command, never text sent by the page', async () => {
            const { panel } = await openPanel();
            await panel.send({ command: 'copyCommand', text: 'rm -rf /' });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('npx folder-structure-pro');
        });

        it('reports a failed command copy', async () => {
            const { panel } = await openPanel();
            vi.mocked(vscode.env.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
            await panel.send({ command: 'copyCommand' });
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Failed to copy the command',
            );
        });

        it('opens the npm package page, never a link sent by the page', async () => {
            const { panel } = await openPanel();
            await panel.send({ command: 'learnMore', url: 'https://example.com' });
            expect(mockOpenExternal).toHaveBeenCalledWith(
                vscode.Uri.parse('https://www.npmjs.com/package/folder-structure-pro'),
            );
        });
    });

    describe('preview', () => {
        it('copies preview text to the clipboard', async () => {
            const { panel } = await openPanel();
            await panel.send({ command: 'copyPreview', text: 'preview text' });
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('preview text');
        });

        it('shows an error when preview copy fails', async () => {
            const { panel } = await openPanel();
            vi.mocked(vscode.env.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
            await panel.send({ command: 'copyPreview', text: 'preview text' });
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to copy preview');
        });
    });
});
