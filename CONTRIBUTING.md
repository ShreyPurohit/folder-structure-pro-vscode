# Contributing to Folder Structure Pro

Thanks for your interest in contributing to Folder Structure Pro. This guide covers reporting issues, local development, and the checks expected before opening a pull request.

## How to Contribute

- **Report bugs**: Open an [issue](https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues) with reproduction steps and your OS, VS Code, and Node.js versions.
- **Suggest features**: Start a [discussion](https://github.com/ShreyPurohit/folder-structure-pro-vscode/discussions) or open an issue describing the use case.
- **Submit code**: Follow the setup and pull request steps below.

## Development Setup

### Required package manager

This repository uses **pnpm 12.21.0** as its only supported package manager. Node.js 24 is used in CI.

Enable Corepack and activate the repository-pinned pnpm version:

```bash
corepack enable
corepack pnpm --version
```

If Corepack is unavailable, install pnpm 12.21.0 using the [official pnpm installation guide](https://pnpm.io/installation).

Use pnpm for all repository dependency and script operations. `npm install` and `npm ci` are not supported for installing this repository's dependencies.

1. **Clone the repository**

    ```bash
    git clone https://github.com/ShreyPurohit/folder-structure-pro-vscode.git
    cd folder-structure-pro-vscode
    ```

2. **Install dependencies**

    Install the exact dependency versions from `pnpm-lock.yaml`:

    ```bash
    pnpm install --frozen-lockfile
    ```

3. **Compile the extension**

    ```bash
    pnpm run compile
    ```

    This runs typechecking and linting, then builds `dist/extension.js`.

4. **Run tests**

    ```bash
    pnpm test
    ```

    Tests use Vitest and are located under `test/`.

5. **Check coverage**

    ```bash
    pnpm run test:coverage
    ```

    This runs the tests with coverage and writes a report to `coverage/`.

6. **Build a VSIX (optional)**

    Node.js 22 or later is required by the VSIX CLI:

    ```bash
    pnpm dlx @vscode/vsce@4.0.0 package --out copy-folder-structure.vsix
    ```

    Packaging runs the `vscode:prepublish` script, which performs a production build.

## Before Opening a Pull Request

Run the checks used by GitHub Actions:

```bash
pnpm run format:check
pnpm run compile
pnpm run check-types:test
pnpm test
pnpm run test:coverage
pnpm dlx @vscode/vsce@4.0.0 package --out copy-folder-structure.vsix
```

Add or update tests for behavior changes. Keep changes focused and follow the existing TypeScript, ESLint, and Prettier conventions.

## Dependency Changes

Use pnpm to add, remove, or update dependencies, and commit `package.json` and `pnpm-lock.yaml` changes together. Do not create or commit `package-lock.json`. `npm install` and `npm ci` are not supported for project dependencies.

## Continuous Integration

Pull requests targeting `main` and pushes to `main` run the **CI** workflow. It checks formatting, lint, types, and builds; runs Vitest on Ubuntu and Windows; uploads a coverage report; and builds a VSIX artifact.

## Pull Request Process

1. Create a branch from `main`, for example `fix/issue-123` or `feat/new-setting`.
2. Describe the problem and solution in the pull request, and link a related issue when applicable.
3. Include or update tests for behavior changes and list the checks you ran.
4. Address review feedback. After approval and required checks pass, a maintainer will merge the pull request.

By contributing, you agree that your contributions are licensed under the repository's [MIT License](LICENSE).
