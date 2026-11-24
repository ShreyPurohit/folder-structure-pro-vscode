# Change Log

## [0.3.0] - 2026-11-24

### Added

- A one-time notification introduces the `npx folder-structure-pro` command-line tool, with **What's New** and **Copy command** buttons. It appears once per user; with Settings Sync on, it appears on one machine only.
- **Folder Structure Pro: What's New** command, to open the What's New page again at any time.

### Changed

- The extension now starts after VS Code finishes starting up (`onStartupFinished`), so the notification can appear. This also lets commands work on VS Code versions before 1.74.
- Redesigned **Create Folder Structure** panel: it shows the destination folder (with **Change…**), lists each line to fix, counts what will be created, offers **Insert example**, supports Ctrl+Enter, and adapts to narrow editor groups. A strip at the bottom introduces the `npx folder-structure-pro` command-line tool.
- **Create Folder Structure** now uses the same engine as the `folder-structure-pro` CLI, so both read and create structures the same way.
- Creation is all or nothing. If a step fails, or you press **Cancel** in the progress notification, everything that run created is removed and replaced files are restored.
- **Replace** now empties only the files that already exist, and moves their old versions to the Trash. Before, it moved whole existing folders to the Trash, including files that were not part of the structure.
- **Create Structure** stays disabled until the structure is valid. A structure with unreadable lines is no longer partly created; the preview lists each problem line instead.
- The `Directory structure:` heading is optional. Before, the first line was always dropped, so a tree pasted without the heading lost its root folder.

### Fixed

- Names that would leave the chosen folder, such as `../` in a JSON structure, are refused before anything is created.
- Files that already exist deeper in the structure are now detected, not only at the top level.

## [0.2.6] - 2026-11-23

### Added

- Standalone CLI package, `folder-structure-pro`, allowing users to copy, export, and create folder structures directly from the command line.
- npm package version badge and CLI installation instructions in the extension README.
- Documentation linking the VS Code extension with its standalone CLI package.

## [0.2.5] - 2026-10-11

### Added

- Inline comment support for both Plain Text and JSON folder structures. Lines annotated with `# ...` or `// ...` (preceded by a space) are silently stripped before parsing, so structures copied from READMEs, AI-generated output, or annotated docs work out of the box.
- Names that legitimately contain `#` (e.g. `C#-project/`, `#changelog`) are unaffected — only a space-prefixed comment marker is stripped.

## [0.2.4] - 2026-09-29

### Fixed

- Preserve directories and sibling files that share a basename (for example, `app/` and `app.json`) in copied folder structures and Plain Text parsing.

## [0.2.3] - 2026-08-03

### Added

- **Copy Folder Structure As...** submenu in the Explorer context menu with **Plain Text** and **JSON** options for one-off format selection.

### Changed

- Removed the standalone **Copy Folder Structure** Explorer menu item; use **Copy Folder Structure As** to pick a format directly.

## [0.2.2] - 2026-04-27

### Added

- Support for multiple files with the same base name and different extensions in both Plain Text and JSON formats (e.g. `package.json` + `package.lock` represented as `"package": ["json", "lock"]`).

### Changed

- Introduced typed folder-structure helpers (`FileLeaf`, `isDirectoryNode`, `isFileLeaf`, `mergeFileExtension`) for safer parsing, validation, formatting, and creation.

### Fixed

- JSON validation now accepts `string[]` file leaves (previously rejected valid multi-extension JSON).
- Plain Text preview formatting for multi-extension entries now renders each file as its own tree line with correct connectors.
- Restored multi-root Plain Text parsing and decorative separator-line tolerance (`│`) without false invalid-line errors.
- JSON creation deduplicates repeated extensions and safely handles extensionless/null file leaves.

## [0.2.1] - 2026-04-27

### Fixed

- Remote SSH/provider compatibility for copy/create structure by keeping filesystem operations Uri-native end-to-end (no early `fsPath` conversion).
- Plain Text multi-root parsing for service-style trees and root-level file entries.
- Plain Text validation handling for decorative separator lines between root blocks.
- Tree formatter root-level connector behavior (`├──` / `└──`) and spacing between root sections.
- JSON structure support for `null` file leaves (e.g. `"Dockerfile": null`) in validation, preview, and creation.

## [0.2.0] - 2025-10-09

### Added

- 📋 **Copy Line Path**: Right-click in the editor to copy `relative/path/to/file:line` (or absolute path if enabled). Optionally include `:column` if enabled in settings.
- 🧩 New setting `includeColumn` to append column number in copied path:line
- 🛣️ New setting `useAbsolutePath` to copy absolute paths instead of workspace

## [0.1.1] - 2025-09-22

### Fixed

- View Example dynamic handling

## [0.1.0] - 2025-09-21

### Added

- Webview preview with live validation
- Replace/Skip/Cancel prompt when target items already exist (uses Trash for Replace)
- Support for JSON file leaves as string file types (e.g., "route": "ts")
- Safer, remote-ready filesystem via `vscode.workspace.fs`
- Tree symbol constants for consistent, readable Unicode output (├──, └──, │)

### Changed

- Plain Text parser is now strict: requires connectors, enforces single root directory, consistent indentation, and ignores the first line as header
- Plain Text creation asks confirmation before proceeding if input is invalid
- Formatter outputs readable tree; JSON output reflects new file-leaf format
- Webview UI modernized (two-column layout, status badge, copy preview, clear input)

### Fixed

- Various encoding issues in tree drawing by using Unicode consistently
- Type-safe configuration access and better error handling

### Previous Versions

- v0.2 Added Banner and Extension Icon
- v0.3 Added Major Support `Create Folder Structure`
- v0.4 Added Feature `Copy File Name`
- v0.5 Changed `Plain Text`
    - GitIngest Format
    - Example Preview
    - Updated Preview Mode
- v0.6 Added ignorePatterns in vscode settings
