# Change Log

## [0.1.0] - 2025-09-16
### Added
- Webview preview with live validation and non-selectable line numbers gutter
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

### Added
- v0.2 Added Banner and Extension Icon
- v0.3 Added Major Support `Create Folder Structure`
- v0.4 Added Feature `Copy File Name`
- v0.5 Changed `Plain Text`
    - GitIngest Format
    - Example Preview
    - Updated Preview Mode
- v0.6 Added ignorePatterns in vscode settings

## [Unreleased]
