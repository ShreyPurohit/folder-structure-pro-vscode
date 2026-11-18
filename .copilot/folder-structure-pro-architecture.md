# Folder Structure Pro — Architecture Research

**Checked:** 2026-11-18  
**Purpose:** Preserve the research and finalized architectural decisions for the future CLI and shared-core implementation.  
**Status:** Planning only; no implementation or package changes are included here.

## Finalized decisions

- Keep the existing GitHub repository and VS Code extension at the repository root.
- Use a pnpm workspace with a private shared core in `packages/core` and a CLI in `packages/cli`.
- Keep the existing extension build format and `vscode.workspace.fs` support.
- Use Node.js filesystem APIs through an adapter owned by `packages/cli`.
- Keep the VS Code filesystem adapter in the existing extension source.
- Core defines the filesystem interface and shared logic only; neither adapter is imported into core.
- Use `@clack/prompts` for terminal interaction, isolated behind the CLI presentation layer.
- Start the CLI with `copy` and `export`, plain text and JSON, clipboard, stdout/file output, filtering and non-interactive use. Add structure creation later.
- Use esbuild initially; bundle the private core into both consumers. Do not publish the core unless a real external API need emerges.
- CLI package is ESM; the existing VS Code extension remains as currently built.

## Existing product and architecture

The current extension is version `0.2.5`, licensed MIT, and targets VS Code `^1.54.0`. It registers five commands:

1. Copy folder structure as plain text.
2. Copy folder structure as JSON.
3. Create a project from plain text or JSON.
4. Copy a file name.
5. Copy an editor line path, optionally with column and absolute path.

It supports `.gitignore` filtering, configured ignore patterns, hidden-file exclusion, inline comments, live webview preview/validation, and replace/skip/cancel when creating structures. The existing extension’s “Replace” behavior uses VS Code Trash operations.

Main implementation locations:

- Extension activation and registration: `src/extension.ts`, `src/commands/`
- Mixed structure operations: `src/services/structure.ts`
- VS Code filesystem wrapper: `src/services/fileSystem.ts`
- Ignore loading: `src/services/gitignore.ts`
- Platform-independent helpers: `src/utils/folderStructure.ts`, `src/utils/parser.ts`
- Formatters: `src/services/formatters/`
- Webview: `src/ui/`
- Tests: `test/`
- Build: `esbuild.js`
- CI/release: `.github/workflows/`

### Verified behavior and issues to preserve or resolve

- The extension uses `vscode.workspace.fs`; preserve this for remote and virtual workspaces.
- Hidden files are always excluded. Default configured ignore patterns are `node_modules` and `.*`.
- Only the selected root `.gitignore` is loaded; nested `.gitignore` files are not currently honored.
- The extension parser ignores the first line as a header, accepts Unicode and ASCII connectors, and supports whitespace-preceded `#`/`//` comments.
- Plain-text validation detects indentation gaps, but creation does not enforce the same validation consistently.
- JSON creation currently risks reporting filesystem errors as invalid JSON because parsing and writes share a broad catch.
- URI-relative calculations use string-prefix logic and need URI-aware handling.
- `ignore` is imported by source, but was not listed as a direct dependency in the inspected root manifest; make dependency ownership explicit during extraction.
- Existing tests cover core parsing, formatting, commands, and mocked filesystem behavior. Add real adapter, symlink, nested-filtering, and cross-platform coverage.

## Core and filesystem contracts

### Ownership

- `packages/core`: filesystem interface, models, traversal orchestration, filters, parsers, formatters, validation and creation planning.
- `packages/cli`: Node filesystem adapter, CLI commands, argument handling, Clack UI, clipboard and terminal output.
- Existing extension source: VS Code filesystem adapter, commands, configuration, webview, clipboard and dialogs.

Core must not import `vscode`, `node:fs`, `node:path`, Clack or terminal libraries. It receives path handles and filesystem operations through the interface.

### Path and filesystem interface

Represent paths as opaque branded handles. Core must not inspect them with native path APIs or concatenate them. Adapters own `joinChild(parent, name)`, `relative`, and basename operations. `joinChild` joins exactly one child component and rejects empty, rooted, `.`/`..`, NUL-containing, and otherwise invalid components, including separators for the adapter's path model. It must not silently normalize, split, or reinterpret invalid names. Ignore matching receives normalized relative paths using `/` separators, with no leading slash or `./`.

The common interface should provide asynchronous:

- `readDirectory`
- `readText`
- `lstat`
- `exists`
- `createDirectory`
- `writeText`
- `joinChild(parent, name)`
- `relative`
- `basename`

Use explicit entry metadata with kinds `file`, `directory`, `symlink`, `unknown` and symlink status `resolved-as-symlink`, `not-a-symlink`, or `unknown`.

`exists()` returns false only for normalized `NOT_FOUND`; permission, provider and I/O errors must propagate as normalized errors. It must not turn arbitrary failures into “missing.”

`createDirectory(path)` has one contract: create the directory and missing parents, or report a normalized error. It does **not** promise symlink prevention. Symlink preflight is separate core orchestration.

Deletion is not needed for copy/export and belongs in a separate optional capability.

### Adapter guarantees and limitations

- **Node adapter:** Use correct static imports, for example `import * as fs from 'node:fs/promises'` and `import * as path from 'node:path'`. Use `lstat()` for link metadata. Use `open(path, 'wx')` for atomic exclusive file creation. Normalize filesystem errors (`ENOENT`, `EEXIST`, `EACCES`, etc.).
- **VS Code adapter:** Use `vscode.workspace.fs`. Do not describe `workspace.fs.stat()` as equivalent to native `lstat()`. Symbolic-link metadata is provider-dependent; preserve `unknown` where it is unavailable. Normalize typed `vscode.FileSystemError` cases first and treat generic errors conservatively as I/O failures.
- `workspace.fs` has no general atomic-exclusive-create operation. It may offer best-effort create-if-absent via existence preflight followed by `writeFile`, but this is racy and is not exclusive. If atomic exclusivity is required, the adapter must refuse.
- Neither adapter can promise race-free creation of a complete tree. Revalidate destination and ancestors before writes; still document TOCTOU limitations.
- Do not follow symlinks during traversal by default. Creation should reject known symlinks and conservatively refuse when provider metadata is unknown.

### Name validation

At the traversal boundary, validate an observed entry name before constructing a child path: reject empty names, `.`/`..`, NUL, and `/`. Use an adapter operation that joins exactly one child component. Apply platform-specific validation where a character is a separator on that platform; for example, `\` can be a valid POSIX filename but a Windows separator.

Keep traversal validation distinct from structure-creation validation. Export should not reject a legitimate observed filename merely because it would not be portable to create elsewhere. Structure creation must apply stricter target-platform checks before planning writes.

## Parsing compatibility

Preserve accepted existing formats: `Directory structure:` header, arbitrary first-line headers, a tree-shaped first line, Unicode/ASCII connectors, four-space/vertical-guide indentation, decorative separators, and supported inline comments.

- A first line equal to `Directory structure:` (case-insensitive, optional surrounding whitespace) is an explicit header.
- A valid tree-shaped first line is a root entry, not a header.
- An arbitrary first line may be treated as an optional header for backward compatibility, but header-only or empty input is invalid.
- Malformed tree entries must be reported, not silently discarded.
- Indentation gaps are invalid.
- Preview and creation must call the same parser and use the same validation result. Creation performs no writes if parsing has errors.

## Filtering contract

Keep defaults separate rather than applying overlapping exclusions from multiple layers:

- **CLI built-in:** `node_modules` plus a dedicated hidden-file rule, hidden entries excluded by default.
- **VS Code:** preserve `folderStructure.ignorePatterns` and `folderStructure.respectGitignore` as-is, including the current `node_modules`, `.*` defaults.
- **Root `.gitignore`:** read only at selected root initially, matching current extension behavior. Nested files are a future compatibility decision.
- **CLI `--exclude`:** additive user exclusions.
- **CLI `--hidden`:** disables only the CLI hidden-file rule; it does not override `node_modules`, `.gitignore`, or explicit `--exclude`.
- Avoid adding implicit core exclusions that duplicate CLI or extension defaults.

Depth: root is depth 0; direct children are depth 1. `--depth 1` includes the root and all direct child entries, but does not descend into direct child directories. Hidden and ignore rules remain independent of depth.

## CLI MVP

Commands:

- `folder-structure-pro`: interactive operation selection in a TTY.
- `copy [path]`: generate structure and copy to clipboard.
- `export [path]`: generate structure and write to stdout or `--output <path>`.

Options: `--format text|json`, `--output <path|->`, `--depth <n>`, repeatable `--exclude <pattern>`, `--hidden`, `--no-gitignore`, `--no-interactive`, `--help`, `--version`.

Do not add `--json`, `--quiet`, `--verbose`, or `--include` in the MVP. stdout is reserved for exported structure data; diagnostics go to stderr. `copy` never emits the generated structure to stdout.

Clipboard failure:

- Interactive: show the error and offer an explicit stdout/export alternative.
- Non-interactive: report to stderr and exit nonzero; do not silently fall back to stdout.

No arguments in a non-TTY environment prints help and returns an argument/usage error. Missing required options may prompt only when interactive mode is enabled. CI must never prompt.

Use `@clack/prompts` only behind a CLI presentation abstraction. Handle cancellation centrally; do not call `process.exit()` inside prompt helpers.

## Workspace and packaging

Least disruptive structure:

```text
packages/
  core/
  cli/
src/                  # Existing extension remains at root
test/
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
esbuild.js
```

The extension should remain at the repository root initially. Root `esbuild.js` continues externalizing `vscode` and bundles core. CLI imports core through the workspace during build; esbuild bundles core into the executable so the published package has no unresolved `workspace:*` runtime dependency.

The CLI tarball should allowlist only `dist`, README, LICENSE and required package metadata. ESM entry needs a Node shebang and a `bin` mapping. Inspect both the packed manifest and tarball contents.

Recommended future validation:

1. Build/test each workspace package.
2. `npm pack --dry-run --json`.
3. Create actual tarball and inspect its contents and embedded `package.json`.
4. Install tarball into a clean temporary project.
5. Run direct Node entry, installed executable, `npx`, `pnpm dlx`, and Windows `.cmd` shim.
6. Repeat smoke tests on Windows, macOS and Linux.

Keep VSIX, Marketplace and Open VSX workflows independent from npm publishing. Use npm trusted publishing/OIDC and provenance when the package is ready to release.

## Research snapshot (versions checked 2026-11-18)

Values below are the research snapshot, not a promise that versions remain latest:

- `@clack/prompts` **1.9.0**, MIT, ESM, Node `>=20.12.0`.
- pnpm **12.21.0**; use `pnpm dlx`, not the legacy standalone `pnpx` package.
- Node active LTS snapshot **26.13.1**; Node 24 was also LTS.
- TypeScript **7.0.2**.
- esbuild **0.28.0** (already used in the repository).
- tsdown **0.23.7**; tsup **9.0.0** (its project README reports it is no longer actively maintained); unbuild **3.6.1**.
- CLI Node floor recommendation: `>=22.14.0`, subject to validating the complete dependency set.

### Official references

- Clack docs: https://github.com/bombshell-dev/clack/tree/main/packages/prompts
- Clack registry: https://registry.npmjs.org/@clack/prompts
- pnpm workspaces: https://pnpm.io/workspaces
- pnpm dlx: https://pnpm.io/cli/dlx
- pnpm registry: https://registry.npmjs.org/pnpm
- Node package/module behavior: https://nodejs.org/api/packages.html
- Node filesystem promises: https://nodejs.org/api/fs.html
- Node argument parsing: https://nodejs.org/api/util.html#utilparseargsconfig
- npm package metadata and `files`: https://docs.npmjs.com/cli/v11/configuring-npm/package-json
- npm executable `bin`: https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin
- npm packing: https://docs.npmjs.com/cli/v11/commands/npm-pack
- npm trusted publishing: https://docs.npmjs.com/trusted-publishers
- TypeScript declaration publishing: https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html
- esbuild: https://esbuild.github.io/
- tsdown: https://tsdown.dev/
- tsup: https://github.com/egoist/tsup
- unbuild: https://github.com/unjs/unbuild

## Implementation roadmap

1. **Workspace and core extraction:** establish pnpm workspace; define core interface and extract pure model, parsing, formatting, filtering and traversal behavior. No adapters belong in core.
2. **Extension migration/regression:** implement VS Code adapter in existing source; preserve settings, remote/virtual `workspace.fs`, commands, webview and VSIX workflow. Verify regression tests.
3. **CLI copy/export:** implement Node adapter, Clack boundary, commands, output handling, filters and non-interactive behavior. Verify temporary-directory and executable tests.
4. **Safe structure creation:** add parser-driven creation plans, target validation, symlink preflight, conflict resolution, dry-run, Node exclusive writes and explicit VS Code best-effort limitations.
5. **Additional CLI features:** consider filename and line-reference commands only after MVP.
6. **Packaging/release:** verify tarball, clean installs, Windows/macOS/Linux, `npx`, `pnpm dlx`, independent VSIX/CLI release and provenance.

## Remaining limitations and implementation checks

- VS Code provider link metadata and atomic behavior vary; preserve `unknown` and do not imply native guarantees.
- Node symlink preflight does not eliminate races.
- Root-only `.gitignore` is retained initially; nested semantics require separate design and tests.
- Package name availability and clipboard implementation remain to be verified before release.
- Confirm actual dependency engine constraints and workspace bundling behavior during implementation.
- Test VS Code URI scheme/authority preservation, Windows drive/UNC paths, and provider error normalization.
