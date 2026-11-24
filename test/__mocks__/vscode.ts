import { vi } from 'vitest';

type Thenable<T> = PromiseLike<T>;

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

export enum ViewColumn {
    One = 1,
}

export class Uri {
    static file(path: string): Uri {
        return Uri.from({ scheme: 'file', path });
    }

    static from(components: {
        scheme: string;
        authority?: string;
        path?: string;
        query?: string;
        fragment?: string;
    }): Uri {
        return new Uri(
            components.scheme,
            components.authority ?? '',
            components.path ?? '',
            components.query ?? '',
            components.fragment ?? '',
        );
    }

    static joinPath(base: Uri, ...segments: string[]): Uri {
        const joined = [base.path.replace(/\/+$/, ''), ...segments]
            .filter(Boolean)
            .join('/')
            .replace(/\/+/g, '/');
        return base.with({ path: joined });
    }

    static parse(value: string, strict = false): Uri {
        if (strict && /%(?![0-9a-f]{2})/i.test(value)) {
            throw new URIError('Malformed URI escape sequence.');
        }
        const match =
            /^([A-Za-z][A-Za-z0-9+.-]*):(?:(\/\/([^/?#]*))?([^?#]*))(?:\?([^#]*))?(?:#(.*))?$/.exec(
                value,
            );
        if (!match) {
            throw new URIError('Malformed URI.');
        }
        return new Uri(match[1], match[3] ?? '', match[4] ?? '', match[5] ?? '', match[6] ?? '');
    }

    constructor(
        readonly scheme: string,
        readonly authority: string,
        readonly path: string,
        readonly query: string,
        readonly fragment: string,
    ) {}

    get fsPath(): string {
        return this.path;
    }

    with(change: {
        scheme?: string;
        authority?: string;
        path?: string;
        query?: string | null;
        fragment?: string | null;
    }): Uri {
        return new Uri(
            change.scheme ?? this.scheme,
            change.authority ?? this.authority,
            change.path ?? this.path,
            change.query ?? this.query,
            change.fragment ?? this.fragment,
        );
    }

    toString(_skipEncoding?: boolean): string {
        const query = this.query ? `?${this.query}` : '';
        const fragment = this.fragment ? `#${this.fragment}` : '';
        const authority = this.authority
            ? `//${this.authority}`
            : this.scheme === 'file'
              ? '//'
              : '';
        return `${this.scheme}:${authority}${this.path}${query}${fragment}`;
    }

    toJSON(): {
        scheme: string;
        authority: string;
        path: string;
        query: string;
        fragment: string;
    } {
        return {
            scheme: this.scheme,
            authority: this.authority,
            path: this.path,
            query: this.query,
            fragment: this.fragment,
        };
    }
}

export interface WorkspaceConfiguration {
    get<T>(key: string, defaultValue?: T): T;
    has(key: string): boolean;
    inspect<T>(key: string): { key: string; defaultValue?: T } | undefined;
    update(key: string, value: unknown): Thenable<void>;
}

export interface Memento {
    get<T>(key: string, defaultValue?: T): T | undefined;
    update(key: string, value: unknown): Thenable<void>;
    setKeysForSync(keys: readonly string[]): void;
}

export interface ExtensionContext {
    subscriptions: Array<{ dispose(): unknown }>;
    globalState: Memento;
    extensionUri: Uri;
}

export interface Webview {
    html: string;
    cspSource: string;
    asWebviewUri(localResource: Uri): Uri;
    postMessage(message: unknown): Thenable<boolean>;
    onDidReceiveMessage(callback: (message: unknown) => unknown): { dispose(): void };
}

export interface WebviewPanel {
    webview: Webview;
    dispose(): void;
}

export const mockFsStat = vi.fn();
export const mockFsReadFile = vi.fn();
export const mockFsWriteFile = vi.fn();
export const mockFsCreateDirectory = vi.fn();
export const mockFsReadDirectory = vi.fn(async (_uri: Uri): Promise<[string, FileType][]> => []);
export const mockFsDelete = vi.fn();
export const mockFsRename = vi.fn();
export const mockFsCopy = vi.fn();
export const mockConfigurationGet = vi.fn(
    <T>(_key: string, defaultValue?: T): T => defaultValue as T,
);
export const mockGetConfiguration = vi.fn(
    (_section?: string, _scope?: unknown): WorkspaceConfiguration => configuration,
);
export const mockAsRelativePath = vi.fn((uri: Uri | string, _includeWorkspaceFolder?: boolean) => {
    const pathValue = typeof uri === 'string' ? uri : uri.path;
    return pathValue.replace(/^\//, '');
});
export const mockShowInformationMessage = vi.fn();
export const mockShowWarningMessage = vi.fn();
export const mockShowErrorMessage = vi.fn();
export const mockShowOpenDialog = vi.fn(
    async (_options?: Record<string, unknown>): Promise<Uri[] | undefined> => undefined,
);
export const mockCreateWebviewPanel = vi.fn();
export enum ProgressLocation {
    Notification = 15,
}
export interface CancellationToken {
    isCancellationRequested: boolean;
    onCancellationRequested(listener: () => void): { dispose(): void };
}
/** Tokens of running progress tasks; `cancelProgress` cancels them like the Cancel button. */
let activeTokens: Array<{ token: CancellationToken; listeners: Array<() => void> }> = [];
export function cancelProgress(): void {
    for (const active of activeTokens) {
        active.token.isCancellationRequested = true;
        for (const listener of active.listeners) {
            listener();
        }
    }
}
async function withProgress<T>(
    _options: unknown,
    task: (progress: { report(value: unknown): void }, token: CancellationToken) => Thenable<T>,
): Promise<T> {
    const listeners: Array<() => void> = [];
    const token: CancellationToken = {
        isCancellationRequested: false,
        onCancellationRequested(listener: () => void) {
            listeners.push(listener);
            return { dispose: () => undefined };
        },
    };
    activeTokens.push({ token, listeners });
    try {
        return await task({ report: () => undefined }, token);
    } finally {
        activeTokens = activeTokens.filter((active) => active.token !== token);
    }
}
export const mockWithProgress = withProgress;
export const mockClipboardWriteText = vi.fn();
export const mockRegisterCommand = vi.fn((...args: unknown[]) => ({ dispose: vi.fn(), args }));

const configuration: WorkspaceConfiguration = {
    get: <T>(key: string, defaultValue?: T): T => mockConfigurationGet(key, defaultValue) as T,
    has: vi.fn(() => false),
    inspect: vi.fn(() => undefined),
    update: vi.fn(() => Promise.resolve()),
};

export const workspace = {
    fs: {
        stat: mockFsStat,
        readFile: mockFsReadFile,
        writeFile: mockFsWriteFile,
        createDirectory: mockFsCreateDirectory,
        readDirectory: mockFsReadDirectory,
        delete: mockFsDelete,
        rename: mockFsRename,
        copy: mockFsCopy,
    },
    getConfiguration: mockGetConfiguration,
    workspaceFolders: [{ uri: Uri.file('/workspace') }],
    asRelativePath: mockAsRelativePath,
};

export const window = {
    showInformationMessage: mockShowInformationMessage,
    showWarningMessage: mockShowWarningMessage,
    showErrorMessage: mockShowErrorMessage,
    showOpenDialog: mockShowOpenDialog,
    createWebviewPanel: mockCreateWebviewPanel,
    withProgress: mockWithProgress,
    activeTextEditor: undefined as
        | {
              document: { uri: Uri };
              selection: { active: { line: number; character: number } };
          }
        | undefined,
};

export const mockOpenExternal = vi.fn(async (_uri: Uri) => true);
export const env = {
    clipboard: {
        writeText: mockClipboardWriteText,
    },
    openExternal: mockOpenExternal,
};

export const mockGetExtension = vi.fn(
    (_id: string): { packageJSON: { version?: string } } | undefined => ({
        packageJSON: { version: '0.3.0' },
    }),
);
export const extensions = {
    getExtension: mockGetExtension,
};
export const commands = {
    registerCommand: mockRegisterCommand,
};

export function resetVscodeMocks(): void {
    mockFsStat.mockReset();
    mockFsReadFile.mockReset();
    mockFsWriteFile.mockReset();
    mockFsCreateDirectory.mockReset();
    mockFsReadDirectory.mockReset();
    mockFsDelete.mockReset();
    mockFsRename.mockReset();
    mockFsCopy.mockReset();
    activeTokens = [];
    mockConfigurationGet.mockReset();
    mockConfigurationGet.mockImplementation(
        <T>(_key: string, defaultValue?: T): T => defaultValue as T,
    );
    mockGetConfiguration.mockReset();
    mockGetConfiguration.mockImplementation(
        (_section?: string, _scope?: unknown): WorkspaceConfiguration => configuration,
    );
    mockAsRelativePath.mockReset();
    mockAsRelativePath.mockImplementation((uri: Uri | string) => {
        const pathValue = typeof uri === 'string' ? uri : uri.path;
        return pathValue.replace(/^\//, '');
    });
    mockShowInformationMessage.mockReset();
    mockShowWarningMessage.mockReset();
    mockShowErrorMessage.mockReset();
    mockShowOpenDialog.mockReset();
    mockCreateWebviewPanel.mockReset();
    mockClipboardWriteText.mockReset();
    mockOpenExternal.mockClear();
    mockGetExtension.mockReset();
    mockGetExtension.mockImplementation(() => ({ packageJSON: { version: '0.3.0' } }));
    mockRegisterCommand.mockReset();
    mockRegisterCommand.mockImplementation((...args: unknown[]) => ({
        dispose: vi.fn(),
        args,
    }));
    window.activeTextEditor = undefined;
}
