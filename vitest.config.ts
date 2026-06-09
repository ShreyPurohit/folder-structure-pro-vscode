import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['test/**/*.test.ts'],
        setupFiles: ['test/setup.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/types/**'],
            thresholds: {
                lines: 95,
                functions: 95,
                branches: 85,
                statements: 95,
            },
        },
    },
    resolve: {
        alias: {
            vscode: path.resolve(__dirname, 'test/__mocks__/vscode.ts'),
        },
    },
});
