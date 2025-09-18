<img src="./assets/banner.webp" alt="Folder Structure Pro" style="width: 100%; height: 250px; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=iamshreydxv.copy-folder-structure">
    <img src="https://img.shields.io/visual-studio-marketplace/v/iamshreydxv.copy-folder-structure" alt="Marketplace Version"/>
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=iamshreydxv.copy-folder-structure">
    <img src="https://img.shields.io/visual-studio-marketplace/d/iamshreydxv.copy-folder-structure" alt="Downloads"/>
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=iamshreydxv.copy-folder-structure">
    <img src="https://img.shields.io/visual-studio-marketplace/r/iamshreydxv.copy-folder-structure" alt="Ratings"/>
  </a>
</p>

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Detailed Usage](#detailed-usage)
    - [Copy Folder Structure](#copy-folder-structure)
    - [Create Folder Structure](#create-folder-structure)
    - [Copy File Name](#copy-file-name)
- [Settings](#settings)
- [Preview](#preview)
    - [Setting](#settings-1)
    - [Context Menu](#context-menu)
    - [Copy File Name](#copy-file-name-2)
    - [Create Folder Structure](#create-folder-structure-2)
        - [Common Usage](#common-usage)
        - [With Git Ingest](#with-git-ingest)
- [Copy Folder Structure Output](#copy-folder-structure-output)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contact](#contact)

## Features

- Copy Folder Structure
    - Two output formats:
        - Plain Text (GitIngest-style tree)
        - JSON
    - Context menu integration
    - Respects .gitignore

- Create Folder Structure
    - JSON and Plain Text inputs
    - Modern UI with live preview, validation, and line numbers
    - Replace/Skip existing items prompt (Replace sends to Trash)

- Copy File Name
    - Quick file name copying to clipboard

## Quick Start

1. Install the extension
2. Right-click any folder in Explorer
3. Choose "Copy Folder Structure" or "Create Folder Structure"

## Detailed Usage

### Copy Folder Structure

1. Right-click a folder in Explorer
2. Select Copy Folder Structure
3. Structure is copied in your preferred format (JSON/Plain Text)

### Create Folder Structure

1. Right-click in Explorer or use Command Palette
2. Choose Create Folder Structure
3. Select the target directory
4. Select format and paste structure
5. Click Create

### Copy File Name

- Right-click any file → Copy File Name

## Settings

- outputFormat: JSON Format | Plain Text Format
- ignorePatterns: patterns to ignore when copying
- respectGitignore: whether to honor .gitignore

## Preview

### Settings

<img src="./assets/cfs_settings.webp" alt="Settings" style="height: 250px; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

### Context Menu

<img src="./assets/cfs_explorer_context.webp" alt="Explorer Context" style="height: 300px; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

### Copy File Name

<img src="./assets/copy_file_name.gif" alt="Copy File Name Example" style="height: 300px; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

### Create Folder Structure

#### Common Usage

<img src="./assets/common_usage.gif" alt="Common Usage" style="width: 100%; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

#### With Git Ingest

<img src="./assets/usage_with_gitIngest.gif" alt="Usage With Git Ingest" style="width: 100%; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

## Copy Folder Structure Output

- JSON (files as type strings):

```json
{
    "app": {
        "api": {
            "analyze-typography": {
                "route": "ts"
            }
        },
        "favicon": "ico",
        "globals": "css",
        "layout": "tsx",
        "page": "tsx"
    }
}
```

- Plain Text (GitIngest-style, human-friendly):

```
Directory structure:
└── app/
    ├── api/
    │   └── analyze-typography/
    │       └── route.ts
    ├── favicon.ico
    ├── globals.css
    ├── layout.tsx
    └── page.tsx
```

Plain Text rules:

- First line is ignored as a header (may contain any text)
- Every line must use connectors (├── or └──; ASCII |-- or `-- also supported)
- Exactly one root directory (level 0) and it must end with `/`
- Indentation must increase by exactly one level
- The UI shows invalid line numbers; if invalid, Create asks for confirmation before proceeding

## How It Works

### Copy Folder Structure

1. Scans the folder while respecting .gitignore
2. Excludes node_modules and hidden files by default
3. Copies in the selected format:
    - JSON: hierarchical object; files are type strings (e.g., "index": "ts")
    - Plain Text: GitIngest-style tree

### Create Folder Structure

1. Reads input from the webview
2. Validates and parses (JSON or Plain Text)
3. Prompts to Replace/Skip if target items exist; Replace sends to Trash
4. Generates folders and files (no overwrite by default)

### Copy File Name

1. Right-click a file in Explorer
2. Copies the file name to clipboard

## Troubleshooting

- No Option in Context Menu: Reload VS Code (Ctrl+Shift+P → Reload Window)
- Clipboard Not Working: Check system permissions
- Input Error (Create): Ensure input follows JSON or Plain Text format
- Copy File Name Not Working: Ensure a valid local file is selected

## License

MIT — see [LICENSE](./LICENSE)

## Contact

Open an issue on the [GitHub repository](https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues)
