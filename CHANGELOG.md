# Change Log

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

## [Unreleased]
