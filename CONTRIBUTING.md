# Contributing to Folder Structure Pro

Thanks for your interest in contributing to Folder Structure Pro. This guide covers reporting issues, local development, and the checks expected before opening a pull request.

## How to Contribute

- **Report bugs**: Open an [issue](https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues) with reproduction steps and your OS, VS Code, and Node.js versions.
- **Suggest features**: Start a [discussion](https://github.com/ShreyPurohit/folder-structure-pro-vscode/discussions) or open an issue describing the use case.
- **Submit code**: Follow the setup and pull request steps below.

## Development Setup

1. **Clone the repository**

    ```bash
    git clone https://github.com/ShreyPurohit/folder-structure-pro-vscode.git
    cd folder-structure-pro-vscode
    ```

2. **Install dependencies**

    CI uses Node.js 24. Install the exact dependency versions from the lockfile:

    ```bash
    npm ci
    ```

3. **Compile the extension**

    ```bash
    npm run compile
    ```

    This runs typechecking and linting, then builds `dist/extension.js`.

4. **Run tests**

    ```bash
    npm test
    ```

    Tests use Vitest and are located under `test/`.

5. **Check coverage**

    ```bash
    npm run test:coverage
    ```

    This runs the tests with coverage and writes a report to `coverage/`.

6. **Build a VSIX (optional)**

    Node.js 22 or later is required by the VSIX CLI:

    ```bash
    npx --yes @vscode/vsce@4.0.0 package --out copy-folder-structure.vsix
    ```

    Packaging runs the `vscode:prepublish` script, which performs a production build.

## Before Opening a Pull Request

Run the checks used by GitHub Actions:

```bash
npm run format:check
npm run compile
npm run check-types:test
npm test
npm run test:coverage
npx --yes @vscode/vsce@4.0.0 package --out copy-folder-structure.vsix
```

Add or update tests for behavior changes. Keep changes focused and follow the existing TypeScript, ESLint, and Prettier conventions.

## Dependency Changes

Keep `package.json` and `package-lock.json` in sync. Use `npm update` to update dependencies within the declared version ranges, or `npm install <package>` when adding a dependency. Commit manifest and lockfile changes together. Do not delete or hand-edit `package-lock.json`; CI installs from it with `npm ci`.

## Continuous Integration

Pull requests targeting `main` and pushes to `main` run the **CI** workflow. It checks formatting, lint, types, and builds; runs Vitest on Ubuntu and Windows; uploads a coverage report; and builds a VSIX artifact.

Tags matching `v*` and manual runs of the **Release** workflow build a VSIX and upload it as an artifact. Tag-triggered runs also create or update a GitHub Release. This does not publish to extension marketplaces.

The **Publish** workflow is manual. Add repository Actions secrets for the marketplaces you want to publish to:

| Secret     | Purpose                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `VSCE_PAT` | Azure DevOps personal access token with Marketplace (Acquire) access for the Visual Studio Marketplace |
| `OVSX_PAT` | Open VSX token from [open-vsx.org](https://open-vsx.org/user-settings/tokens)                          |

Choose one or both targets when starting the workflow. The selected target requires its matching secret.

## Pull Request Process

1. Create a branch from `main`, for example `fix/issue-123` or `feat/new-setting`.
2. Describe the problem and solution in the pull request, and link a related issue when applicable.
3. Include or update tests for behavior changes and list the checks you ran.
4. Address review feedback. After approval and required checks pass, a maintainer will merge the pull request.

By contributing, you agree that your contributions are licensed under the repository's [MIT License](LICENSE).
