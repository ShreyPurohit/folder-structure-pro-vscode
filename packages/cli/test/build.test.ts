import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageDirectory = path.resolve(import.meta.dirname, '..');
const bundlePath = path.join(packageDirectory, 'dist', 'index.js');
const manifestPath = path.join(packageDirectory, 'package.json');

describe('CLI bundle', () => {
    it('is a silent Node executable with core bundled and Node built-ins external', () => {
        const output = execFileSync(process.execPath, [bundlePath], { encoding: 'utf8' });
        const bundle = fs.readFileSync(bundlePath, 'utf8');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            dependencies?: Record<string, string>;
            private?: boolean;
        };

        expect(output).toBe('');
        expect(bundle.startsWith('#!/usr/bin/env node')).toBe(true);
        expect(bundle).toContain('FolderFileSystemError');
        expect(bundle).toContain('from "node:fs/promises"');
        expect(bundle).toContain('from "node:path"');
        expect(bundle).not.toContain('@folder-structure-pro/core');
        expect(JSON.stringify(manifest.dependencies ?? {})).not.toContain('workspace:');
        expect(manifest.private).toBe(true);
    });
});
