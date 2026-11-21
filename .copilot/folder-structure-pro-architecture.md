# Folder Structure Pro — Architecture Research

**Checked:** 2026-11-18
**Purpose:** Preserve research, finalized architectural decisions, implementation status, and the remaining roadmap.
**Status:** Active architecture and implementation record.

## Implementation status (2026-11-21)

- **Completed:** pnpm workspace and private shared-core extraction, including shared models, traversal, filtering, parsing, formatting, and validation.
- **Completed:** VS Code adapter and extension migration, with extension regression verification and the existing VSIX workflow retained.
- **Completed:** CLI Step 3A foundation, including the Node filesystem adapter, exclusive-create capability, ESM/esbuild executable bundle, and adapter/build tests.
- **Completed:** CLI Step 3B interactive copy/export MVP, with shared-core traversal/formatting, independent filters, bounded preview, clipboard handling, and safe file conflict handling.
- **Completed:** CLI Step 3C interactive structure creation, with shared-core parsing, validation, planning, conflict handling, revalidation, and exclusive creation of new files.
- **Completed:** CLI Step 3D direct `copy`, `export`, and `create` commands, with non-interactive argument validation, help, output routing, exit codes, and explicit creation conflict policies.
- **Completed:** CLI Step 3E.1 package metadata and tarball validation.
- **Completed:** CLI Step 3E.2 isolated consumer installation and installed-binary validation through the packed tarball in a consumer project.
- **Completed:** CLI Step 3F.2 runtime and platform validation; the dedicated Ubuntu Node.js 22.14.0 package-validation job passed, and the Node.js 24 test matrix passed on Windows, Ubuntu, and macOS.
- **Completed:** CLI Step 3F.3 documentation updates for package status, runtime/platform validation, and contributor CI guidance.
- **Remaining:** Later roadmap phases below. The CLI package remains private and unpublished; npm publication is unimplemented and requires a separate future decision.

## Finalized decisions

- Keep the existing GitHub repository and VS Code extension at the repository root.
- Use a pnpm workspace with a private shared core in `packages/core` and a CLI in `packages/cli`.
- Keep the existing extension build format and `vscode.workspace.fs` support.
- Use Node.js filesystem APIs through an adapter owned by `packages/cli`.
- Keep the VS Code filesystem adapter in the existing extension source.
- Core defines the filesystem interface and shared logic only; neither adapter is imported into core.
- Use `@clack/prompts` for terminal interaction, isolated behind the CLI presentation layer.
- The CLI supports interactive and direct copy/export/creation using the shared core. Further CLI features remain out of scope for Step 3D.
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

The existing plain-text parser ignores the first line unconditionally as the root/header line. Subsequent lines support Unicode and ASCII connectors, four-space/vertical-guide indentation, and supported inline comments.

- Keep the first-line behavior; creation must not reinterpret a tree-shaped first line as an entry.
- Malformed connector lines and indentation gaps are reported in `invalidLines`. Creation rejects the complete input if any invalid lines are reported; it must not use a partial parse.
- JSON creation uses the shared JSON-with-comments parser and structure validation.
- Creation parses once, validates the complete structure, and plans only from that validated result. No filesystem mutation starts before final confirmation.

## Filtering contract

Keep defaults separate rather than applying overlapping exclusions from multiple layers:

- **CLI built-in:** `node_modules` plus a dedicated hidden-file rule, hidden entries excluded by default.
- **VS Code:** preserve `folderStructure.ignorePatterns` and `folderStructure.respectGitignore` as-is, including the current `node_modules`, `.*` defaults.
- **Root `.gitignore`:** read only at selected root initially, matching current extension behavior. Nested files are a future compatibility decision.
- **CLI additional ignore patterns:** additive user exclusions.
- **CLI hidden option:** disables only the built-in hidden-file exclusion; it does not override `node_modules`, `.gitignore`, or explicit user patterns.
- Avoid adding implicit core exclusions that duplicate CLI or extension defaults.

Depth: root is depth 0; direct children are depth 1. A maximum depth of 1 includes direct child entries but does not descend into their directories. Hidden and ignore rules remain independent of depth.

## Current CLI workflow

- With no arguments, a TTY opens the interactive menu. Non-TTY invocation without a command exits with status 2; explicit commands never prompt.
- Direct commands are `copy [directory]`, `export [directory] --output <file|->`, and `create <structure-file> --format <text|json> --yes`.
- Copy/export supports plain text or JSON, filtering, clipboard copy, UTF-8 file export, and stdout-only structure output with `export --output -`.
- Interactive creation validates and previews a bounded plan before conflict handling and final confirmation. Direct creation requires `--yes` and defaults to `--on-conflict fail`; replacing a regular file requires `--on-conflict replace`.
- Existing matching directories are reused. Existing regular files can be skipped or explicitly replaced with empty files. Symlinks, unknown metadata, and file/directory mismatches block the operation.
- `export --output -` reserves stdout for structure data; command diagnostics are written to stderr. Exit codes are 0 for success/help/cancellation, 1 for execution failures, and 2 for invalid commands/arguments or non-TTY use without a command.
- Clack remains behind the CLI presentation abstraction. Cancellation is handled centrally; prompt helpers do not call `process.exit()`.

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

Packaging validation completed in Steps 3E.1 and 3E.2: the package metadata and tarball are checked, and the actual tarball is installed into an isolated npm consumer where the installed binary is exercised. The existing test creates the tarball with `pnpm pack --pack-destination <temp-directory>`; npm is used only to install that local tarball. The installed-package test passes in the Node.js 24 Windows, Ubuntu, and macOS test matrix. The dedicated Ubuntu CLI package-validation job also passes on Node.js 22.14.0. These checks do not publish the package; it remains private and unpublished.

The declared Node.js minimum (`>=22.14.0`) is validated for CLI package validation on Ubuntu. The Node.js 24 test matrix passes on Windows, Ubuntu, and macOS. Invocation through `npx`, `pnpm dlx`, or global installation remains unvalidated; headless Linux environments may not provide clipboard access. CLI packaging validation exercises a local tarball and is not npm publication. CLI npm publication is not configured and requires a separate future decision. The existing `publish.yml` workflow publishes the VS Code extension VSIX to Visual Studio Marketplace/Open VSX, while `release.yml` builds the extension VSIX and can create a GitHub Release; neither publishes the CLI. Keep those extension workflows independent from any future CLI npm release.

## Research snapshot (versions checked 2026-11-18)

Values below are the research snapshot, not a promise that versions remain latest:

- `@clack/prompts` **1.9.0**, MIT, ESM, Node `>=20.12.0`.
- pnpm **12.21.0**; use `pnpm dlx`, not the legacy standalone `pnpx` package.
- Node active LTS snapshot **26.13.1**; Node 24 was also LTS.
- TypeScript **7.0.2**.
- esbuild **0.28.0** (already used in the repository).
- tsdown **0.23.7**; tsup **9.0.0** (its project README reports it is no longer actively maintained); unbuild **3.6.1**.
- The CLI package declares Node.js `>=22.14.0`. CI validates package installation at Node.js 22.14.0 on Ubuntu and runs the test suite on Node.js 24 across Windows, Ubuntu, and macOS.

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

1. **Workspace and core extraction — completed:** pnpm workspace and pure shared models, parsing, formatting, validation, filtering, and traversal are in `packages/core`.
2. **Extension migration/regression — completed:** the extension uses the shared core through its VS Code filesystem adapter while preserving remote/virtual `workspace.fs`, commands, webview, and VSIX workflow.
3. **CLI copy/export — completed:** Steps 3A–3B provide the Node adapter and ESM executable foundation, Clack interaction, shared-core copy/export, filtering, preview, clipboard, and file output. Step 3D adds direct commands, argument/help handling, stdout export, exit codes, and non-interactive creation with explicit conflict policies.
4. **Safe structure creation — completed:** Step 3C adds parser-driven validation and creation plans, destination and entry metadata checks, bounded preview, explicit replace/skip/cancel handling, final confirmation, revalidation, and exclusive Node file creation. The existing VS Code extension behavior remains unchanged.
5. **Additional CLI features — remaining:** consider dry-run, configuration, shell completion, and other features only after the MVP.
6. **CLI packaging and compatibility validation — completed:** Steps 3E.1 and 3E.2 verify package metadata and tarball contents, then install the tarball into an isolated npm consumer and exercise the installed binary. The Node.js 24 test matrix passes on Windows, Ubuntu, and macOS; the dedicated Ubuntu package-validation job passes on Node.js 22.14.0. **Remaining:** `npx`, `pnpm dlx`, and global-install invocation remain unvalidated; headless clipboard access may be unavailable. These checks are distinct from npm publication, which remains unimplemented and requires a separate future decision. The existing VSIX marketplace and GitHub Release workflows are for the VS Code extension only.

## Remaining limitations and implementation checks

- VS Code provider link metadata and atomic behavior vary; preserve `unknown` and do not imply native guarantees.
- CLI structure creation is not atomic. Earlier completed changes can remain after a later operation fails; there is no automatic rollback.
- Node symlink preflight and revalidation do not eliminate time-of-check/time-of-use races. The existing filesystem contract can verify the destination entry and planned paths but does not provide a race-free tree transaction or guarantee that ancestor path components contain no symlinks.
- Root-only `.gitignore` is retained initially; nested semantics require separate design and tests.
- Package name availability and clipboard implementation remain to be verified before release.
- Confirm actual dependency engine constraints and workspace bundling behavior during implementation.
- Test VS Code URI scheme/authority preservation, Windows drive/UNC paths, and provider error normalization.
