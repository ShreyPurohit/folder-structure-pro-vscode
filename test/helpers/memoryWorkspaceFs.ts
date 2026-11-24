import { vi } from 'vitest';
import {
    FileType,
    Uri,
    mockFsCopy,
    mockFsCreateDirectory,
    mockFsDelete,
    mockFsReadDirectory,
    mockFsReadFile,
    mockFsRename,
    mockFsStat,
    mockFsWriteFile,
} from '../__mocks__/vscode';

interface Node {
    type: FileType;
    content?: Uint8Array;
}

function providerError(code: string, message: string): Error & { code: string } {
    return Object.assign(new Error(message), { code });
}

/**
 * An in-memory workspace.fs with the VS Code behaviours creation depends on: rename and
 * copy honour `overwrite: false`, a non-recursive delete refuses a non-empty folder, and
 * deleting with `useTrash` is recorded.
 */
export function installMemoryWorkspaceFs(initial: Record<string, string | null> = {}) {
    const nodes = new Map<string, Node>();
    const trashed: string[] = [];
    const key = (uri: Uri) => uri.path.replace(/\/+$/, '') || '/';
    const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
    const childrenOf = (path: string) =>
        [...nodes.keys()].filter((candidate) => candidate !== path && parentOf(candidate) === path);
    const ensureParent = (path: string) => {
        const parent = nodes.get(parentOf(path));
        if (!parent || parent.type !== FileType.Directory) {
            throw providerError('FileNotFound', `Parent of ${path} does not exist.`);
        }
    };
    const setDirectory = (path: string) => {
        for (let index = 1; index <= path.length; index++) {
            if (index === path.length || path[index] === '/') {
                const prefix = path.slice(0, index) || '/';
                if (!nodes.has(prefix)) {
                    nodes.set(prefix, { type: FileType.Directory });
                }
            }
        }
    };
    setDirectory('/');
    for (const [path, content] of Object.entries(initial)) {
        if (content === null) {
            setDirectory(path);
        } else {
            setDirectory(parentOf(path));
            nodes.set(path, { type: FileType.File, content: new TextEncoder().encode(content) });
        }
    }

    mockFsStat.mockImplementation(async (uri: Uri) => {
        const node = nodes.get(key(uri));
        if (!node) {
            throw providerError('FileNotFound', `${uri.path} not found.`);
        }
        return { type: node.type, ctime: 0, mtime: 0, size: node.content?.length ?? 0 };
    });
    mockFsReadDirectory.mockImplementation(async (uri: Uri) =>
        childrenOf(key(uri)).map(
            (path) =>
                [path.slice(path.lastIndexOf('/') + 1), nodes.get(path)!.type] as [
                    string,
                    FileType,
                ],
        ),
    );
    mockFsReadFile.mockImplementation(async (uri: Uri) => {
        const node = nodes.get(key(uri));
        if (!node || node.type !== FileType.File) {
            throw providerError('FileNotFound', `${uri.path} not found.`);
        }
        return node.content ?? new Uint8Array();
    });
    mockFsWriteFile.mockImplementation(async (uri: Uri, content: Uint8Array) => {
        const path = key(uri);
        ensureParent(path);
        if (nodes.get(path)?.type === FileType.Directory) {
            throw providerError('FileIsADirectory', `${path} is a directory.`);
        }
        nodes.set(path, { type: FileType.File, content });
    });
    mockFsCreateDirectory.mockImplementation(async (uri: Uri) => {
        setDirectory(key(uri));
    });
    mockFsDelete.mockImplementation(
        async (uri: Uri, options: { recursive?: boolean; useTrash?: boolean } = {}) => {
            const path = key(uri);
            if (!nodes.has(path)) {
                throw providerError('FileNotFound', `${path} not found.`);
            }
            const children = [...nodes.keys()].filter((candidate) =>
                candidate.startsWith(`${path}/`),
            );
            if (children.length > 0 && !options.recursive) {
                throw providerError('Unknown', `${path} is not empty.`);
            }
            for (const child of children) {
                nodes.delete(child);
            }
            nodes.delete(path);
            if (options.useTrash) {
                trashed.push(path);
            }
        },
    );
    const move =
        (copy: boolean) =>
        async (source: Uri, target: Uri, options: { overwrite?: boolean } = {}) => {
            const from = key(source);
            const to = key(target);
            const node = nodes.get(from);
            if (!node) {
                throw providerError('FileNotFound', `${from} not found.`);
            }
            if (nodes.has(to) && !options.overwrite) {
                throw providerError('FileExists', `${to} already exists.`);
            }
            ensureParent(to);
            nodes.set(to, { ...node });
            if (!copy) {
                nodes.delete(from);
            }
        };
    mockFsRename.mockImplementation(move(false));
    mockFsCopy.mockImplementation(move(true));

    return {
        nodes,
        trashed,
        /** All paths with file contents, for comparing the whole file system with a snapshot. */
        snapshot: () =>
            [...nodes]
                .map(
                    ([path, node]) =>
                        [
                            path,
                            node.content ? new TextDecoder().decode(node.content) : null,
                        ] as const,
                )
                .sort(([a], [b]) => a.localeCompare(b)),
        read: (path: string) => {
            const node = nodes.get(path);
            return node?.content ? new TextDecoder().decode(node.content) : undefined;
        },
        uri: (path: string) => Uri.file(path),
        failNext: (mock: typeof mockFsRename, error: Error) => {
            mock.mockImplementationOnce(async () => {
                throw error;
            });
        },
        vi,
    };
}
