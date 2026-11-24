import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NodeFileSystemAdapter } from '../src/adapters/nodeFileSystem.js';

let directory: string;
afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
});
async function setup() {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'folder-structure-rollback-'));
    const adapter = new NodeFileSystemAdapter();
    return { adapter, at: (name: string) => adapter.toFolderPath(path.join(directory, name)) };
}

describe('NodeFileSystemAdapter undo operations', () => {
    it('moves a file aside, leaves an empty file with the same permissions, and restores it', async () => {
        const { adapter, at } = await setup();
        const file = path.join(directory, 'script.sh');
        await fs.writeFile(file, 'echo hi', { mode: 0o750 });
        await fs.chmod(file, 0o750);

        const backup = await adapter.replaceWithEmptyFile(at('script.sh'));
        await expect(fs.readFile(file, 'utf8')).resolves.toBe('');
        if (process.platform !== 'win32') {
            expect((await fs.stat(file)).mode & 0o777).toBe(0o750);
        }
        expect(path.dirname(backup)).toBe(directory);
        await expect(fs.readFile(backup, 'utf8')).resolves.toBe('echo hi');

        await adapter.restoreFile(backup, at('script.sh'));
        await expect(fs.readFile(file, 'utf8')).resolves.toBe('echo hi');
        await expect(fs.readdir(directory)).resolves.toEqual(['script.sh']);
    });

    it('refuses to replace or remove anything that is not a regular file', async () => {
        const { adapter, at } = await setup();
        await fs.mkdir(path.join(directory, 'folder'));
        await expect(adapter.replaceWithEmptyFile(at('folder'))).rejects.toThrow(
            'Only a regular file can be replaced.',
        );
        await expect(adapter.removeFile(at('folder'))).rejects.toThrow(
            'Only a regular file can be removed.',
        );
        if (process.platform !== 'win32') {
            await fs.writeFile(path.join(directory, 'target.txt'), 'safe');
            await fs.symlink(path.join(directory, 'target.txt'), path.join(directory, 'link'));
            await expect(adapter.removeFile(at('link'))).rejects.toThrow();
            await expect(fs.readFile(path.join(directory, 'target.txt'), 'utf8')).resolves.toBe(
                'safe',
            );
        }
    });

    it('removes a directory only when it is empty', async () => {
        const { adapter, at } = await setup();
        await fs.mkdir(path.join(directory, 'empty'));
        await fs.mkdir(path.join(directory, 'full'));
        await fs.writeFile(path.join(directory, 'full', 'keep.txt'), 'keep');

        await adapter.removeEmptyDirectory(at('empty'));
        await expect(adapter.removeEmptyDirectory(at('full'))).rejects.toThrow();
        await expect(fs.readdir(directory)).resolves.toEqual(['full']);
        await expect(fs.readFile(path.join(directory, 'full', 'keep.txt'), 'utf8')).resolves.toBe(
            'keep',
        );
    });
});
