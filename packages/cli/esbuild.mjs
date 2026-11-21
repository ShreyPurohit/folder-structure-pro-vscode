import { build } from 'esbuild';

await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outfile: 'dist/index.js',
    external: ['node:*', 'clipboardy'],
    packages: 'bundle',
    banner: {
        js: '#!/usr/bin/env node',
    },
});
