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

    static parse(value: string): Uri {
        const match = /^([^:/?#]+):\/\/([^?#]*)(\?([^#]*))?(#(.*))?$/.exec(value);
        if (!match) {
            return Uri.file(value);
        }
        return new Uri(match[1], '', match[2], match[4] ?? '', match[6] ?? '');
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
        return `${this.scheme}://${this.path}${query}${fragment}`;
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

export interface ExtensionContext {
    subscriptions: Array<{ dispose(): unknown }>;
}

export interface Webview {
    html: string;
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
    activeTextEditor: undefined as
        | {
              document: { uri: Uri };
              selection: { active: { line: number; character: number } };
          }
        | undefined,
};

export const env = {
    clipboard: {
        writeText: mockClipboardWriteText,
    },
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
    mockRegisterCommand.mockReset();
    mockRegisterCommand.mockImplementation((...args: unknown[]) => ({
        dispose: vi.fn(),
        args,
    }));
    window.activeTextEditor = undefined;
}
