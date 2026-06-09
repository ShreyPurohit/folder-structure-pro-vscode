import { describe, expect, it } from 'vitest';
import {
    fileLeafToDisplayNames,
    fileLeafToFileNames,
    isDirectoryNode,
    isFileLeaf,
    mergeFileExtension,
    normalizeFileLeafExtensions,
} from '../../src/utils/folderStructure';
import type { FileLeaf, FolderStructure } from '../../src/types';

describe('folderStructure helpers', () => {
    it('identifies directory nodes', () => {
        const dir: FolderStructure = { src: {} };
        expect(isDirectoryNode(dir)).toBe(true);
        expect(isDirectoryNode('ts')).toBe(false);
        expect(isDirectoryNode(['json', 'lock'])).toBe(false);
        expect(isDirectoryNode(null)).toBe(false);
    });

    it('identifies file leaves', () => {
        expect(isFileLeaf('ts')).toBe(true);
        expect(isFileLeaf(['json', 'lock'])).toBe(true);
        expect(isFileLeaf(null)).toBe(true);
        expect(isFileLeaf({ nested: 'ts' })).toBe(false);
    });

    it('merges file extensions', () => {
        expect(mergeFileExtension(undefined, 'json')).toBe('json');
        expect(mergeFileExtension('json', 'json')).toBe('json');
        expect(mergeFileExtension('json', 'lock')).toEqual(['json', 'lock']);
        expect(mergeFileExtension(['json'], 'lock')).toEqual(['json', 'lock']);
        expect(mergeFileExtension(['json', 'lock'], 'lock')).toEqual(['json', 'lock']);
        expect(mergeFileExtension(null, 'json')).toEqual(['file', 'json']);
        expect(mergeFileExtension(null, 'file')).toBe(null);
    });

    it('converts file leaves to display and file names', () => {
        expect(fileLeafToDisplayNames('package', 'json')).toEqual(['package.json']);
        expect(fileLeafToDisplayNames('Dockerfile', null)).toEqual(['Dockerfile']);
        expect(fileLeafToDisplayNames('README', 'file')).toEqual(['README']);
        expect(fileLeafToDisplayNames('package', ['json', 'lock'])).toEqual([
            'package.json',
            'package.lock',
        ]);
        expect(fileLeafToFileNames('package', ['json', 'lock'])).toEqual([
            'package.json',
            'package.lock',
        ]);
    });

    it('normalizes file leaf extensions', () => {
        expect(normalizeFileLeafExtensions('json')).toEqual(['json']);
        expect(normalizeFileLeafExtensions(null)).toEqual(['file']);
        expect(normalizeFileLeafExtensions(['json', null] as FileLeaf)).toEqual(['json', 'file']);
    });
});
