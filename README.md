<img src="./assets/banner.webp" alt="Folder Structure Pro" style="border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

<p align="center">
  <a href="https://github.com/ShreyPurohit/folder-structure-pro-vscode/stargazers">
    <img src="https://img.shields.io/github/stars/ShreyPurohit/folder-structure-pro-vscode" alt="GitHub Stars"/>
  </a>
  <a href="https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues">
    <img src="https://img.shields.io/github/issues/ShreyPurohit/folder-structure-pro-vscode" alt="Open Issues"/>
  </a>
  <a href="https://www.npmjs.com/package/folder-structure-pro">
    <img src="https://img.shields.io/npm/v/folder-structure-pro" alt="npm version"/>
  </a>
  <a href="https://github.com/sponsors/ShreyPurohit">
    <img src="https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ff69b4?style=flat-square&logo=github" alt="Sponsor me on GitHub"/>
  </a>
</p>

<p align="center">
  <strong>🚀 Copy & create folder structures, file names and jump-ready line paths.</strong>
</p>

<hr style="border: 2px solid black; width: 100%; " />

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
    - [Command-Line Interface (NEW!)](#-command-line-interface-new)
- [How to Use](#how-to-use)
- [Settings](#settings)
- [Live Previews](#live-previews)
- [Output Examples](#output-examples)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

<hr style="border: 2px solid black; width: 100%; " />

## Features

<img src="./assets/folder_structure_pro.png" alt="Folder Structure Pro Features" style="border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

### 📁 Copy Folder Structure

- 🎯 **Two Output Formats**: JSON & Plain Text
- 🖱️ **Right-Click Integration**: Easy access from Explorer context menu
- 🙈 **Respects .gitignore**: Automatically excludes ignored files
- ⚡ **Smart Filtering**: Skips node_modules and hidden files

### 🏗️ Create Folder Structure

- 📝 **Multiple Input Formats**: Support for JSON and Plain Text
- 🖥️ **Modern UI**: Shows the destination folder, a live preview of what will be created, each line to fix, and a count on the Create button; works in narrow editor groups
- 🔄 **Smart Handling**: Existing folders are reused; for existing files you choose Replace or Skip
- 🗑️ **Safe Replace**: Only the conflicting files are emptied, and their old versions go to the Trash
- 🛡️ **All or Nothing**: If anything fails, or you press Cancel, everything that run created is removed and replaced files are restored
- 🔒 **Safe Names**: Names that would leave the chosen folder (such as `../`) are refused before anything is created
- 💬 **Inline Comment Support**: `#` and `//` comments are silently ignored — paste annotated structures from READMEs or AI output directly

### 📄 Copy File Name

- ⚡ **One-Click Copy**: Quick file name copying to clipboard
- 🎯 **Simple & Fast**: Right-click any file to copy its name

### Copy Line Path

- 📋 **Copy jump-ready `relative/path:line`** for VS Code Quick Open
- ⚙️ **Configurable**: Optional `:column` and absolute path modes
- ⌨️ **Keyboard Binding**: `Ctrl+Shift+T` / `CMD+k CMD+t` on Mac

<hr style="border: 2px solid black; width: 100%; " />

## Quick Start

1. 📥 **Install** the extension from VS Code Marketplace
2. 🖱️ **Right-click** any folder in Explorer
3. 🎯 **Choose** "Copy Folder Structure As" or "Create Folder Structure"
4. 🎉 **Done!** Your structure is ready to use

### ⚡ Command-Line Interface **(NEW!)**

**Prefer the terminal? Folder Structure Pro is now available as a standalone CLI!**

Generate, copy, export, and recreate project folder structures directly from your terminal — without opening VS Code.

**Install and get started:**

```bash
# Run directly without a global installation
npx folder-structure-pro
```

Or install it globally:

```bash
npm install -g folder-structure-pro
```

**Quick examples:**

```bash
# Copy the current project's structure
folder-structure-pro copy

# Export a structure to a text file
folder-structure-pro export . --output folder-structure.txt

# Recreate a project from an exported structure
folder-structure-pro create structure.txt --to ./new-project --yes
```

The CLI supports interactive mode, clipboard copying, text and JSON formats, flexible filtering, and safe structure creation.

- 📦 **[Get it on npm](https://www.npmjs.com/package/folder-structure-pro)**
- 📖 **[Read the CLI documentation](./packages/cli/README.md)**

Requires Node.js `>=22.14.0`.

<hr style="border: 2px solid black; width: 100%; " />

## How to Use

### 📁 Copy Folder Structure

1. 🖱️ Right-click a folder in VS Code Explorer
2. 📋 Select **"Copy Folder Structure As"** and choose **Plain Text** or **JSON**
3. 📄 Structure is copied to clipboard in the selected format

### 🏗️ Create Folder Structure

1. 🖱️ Right-click in Explorer **OR** use Command Palette (`Ctrl+Shift+P`)
2. 🎯 Choose **"Create Folder Structure"**
3. 📂 Select the target directory
4. 📝 Choose format and paste your structure
5. ✨ Click **Create** and watch the magic happen!

### 📄 Copy File Name

- 🖱️ Right-click any file → 📋 **"Copy File Name"**

### 📋 Copy Line Path

- 🖱️ Right-click inside the editor → 📋 **"Copy Line Path"**
- 📝 Paste into Quick Open (`Ctrl+P` / `Cmd+P`) to jump directly to that line.

<hr style="border: 2px solid black; width: 100%; " />

## Settings

Configure the extension to work exactly how you want:

- 📄 **outputFormat**: Choose between JSON Format or Plain Text Format
- 🚫 **ignorePatterns**: Specify patterns to ignore when copying structures
- 🙈 **respectGitignore**: Honor .gitignore rules (recommended: enabled)
- 🧩 **includecolumn**: Include column number in copied path:line
- 🛣️ **useAbsolutePath**: Use absolute paths instead of workspace-relative

### 🎛️ Settings Preview

<img src="./assets/cfs_settings.png" alt="Extension Settings" style="border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

<hr style="border: 2px solid black; width: 100%; " />

## Live Previews

### 🖱️ Context Menu Integration

<img src="./assets/context.png" alt="Explorer Context Menu" style="border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

### 📄 Copy File Name in Action

<img src="./assets/copy_file_name.gif" alt="Copy File Name Demo" style="border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

### 🏗️ Create Folder Structure

#### 💼 Common Usage

<img src="./assets/common_usage.gif" alt="Common Usage Demo" style="width: 100%; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

#### 🔗 With Git Ingest Integration

<img src="./assets/usage_with_gitIngest.gif" alt="Git Ingest Integration Demo" style="width: 100%; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

### 📋 Copy Line Path

<img src="./assets/copy_path_line.gif" alt="Copy Line Path Demo" style="width: 100%; border: 4px solid rgba(255, 255, 255, 0.9); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">

<hr style="border: 2px solid black; width: 100%; " />

## Output Examples

### 🗂️ JSON Format

Perfect for programmatic use - files are represented as type strings:

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

Inline comments (`#` or `//`) are supported and ignored during parsing:

```json
{
    "app": { // root of the Next.js app
        "api": { # server-side routes
            "analyze-typography": {
                "route": "ts" // API handler
            }
        },
        "favicon": "ico",
        "globals": "css", // global styles
        "layout": "tsx",
        "page": "tsx"
    }
}
```

### 🌳 Plain Text Format

Human-friendly GitIngest-style tree structure:

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

Inline comments (`#` or `//`) are supported and ignored during parsing:

```
Directory structure:
└── app/
    ├── api/              # server-side routes
    │   └── analyze-typography/
    │       └── route.ts  // API handler
    ├── favicon.ico
    ├── globals.css       // global styles
    ├── layout.tsx
    └── page.tsx
```

### 📝 Plain Text Rules:

- ✅ The `Directory structure:` heading is optional
- 🔗 Every line must use tree connectors (`├──` or `└──`)
- 📁 One or more root entries; directories end with `/`, and root-level files are supported
- 📏 Consistent indentation (increases by one level each time)
- 💬 Inline comments (`# ...` or `// ...`) after a space are silently ignored — names like `C#-project` are safe
- ⚠️ Invalid lines are listed in the preview with their line numbers; **Create Structure** stays disabled until every line can be read

### 📋 Copy Line Path

- 📋 Copies `relative/path/to/file:line` (or absolute path if enabled)
- `:column` can be appended if enabled in settings
- `utils/animations/executionAnimations.ts:152:16`

<hr style="border: 2px solid black; width: 100%; " />

## How It Works

### 📁 Copy Folder Structure

1. 🔍 **Scans** the selected folder intelligently
2. 🙈 **Respects** .gitignore and exclude patterns
3. 🚫 **Filters out** node_modules and hidden files automatically
4. 📋 **Copies** structure in the format you pick from the submenu (JSON or Plain Text)

### 🏗️ Create Folder Structure

1. 📖 **Reads** input from the modern webview interface, with the same rules as the CLI
2. ✅ **Validates** the structure and checks every name and existing path in the chosen folder
3. ⚠️ **Asks** Replace or Skip when files already exist, listing them
4. ✨ **Creates** everything, or nothing: a failure or Cancel undoes the whole run

### 📄 Copy File Name

1. 🖱️ **Right-click** any file in Explorer
2. 📋 **Copies** the file name directly to clipboard

### 📋 Copy Line Path

1. ⚙️ **Reads your settings** to determine column and path mode
2. 🛣️ **Builds a path string** (relative or absolute) and normalizes separators to `/`
3. 🔢 **Appends** `:line` (and `:column` when enabled) using 1-based positions
4. 📋 **Copies** the result to the clipboard for Quick Open compatibility

<hr style="border: 2px solid black; width: 100%; " />

## Troubleshooting

### ❓ Common Issues & Solutions:

**🚫 No Option in Context Menu**

- 🔄 **Solution**: Reload VS Code (`Ctrl+Shift+P` → "Reload Window")

**📋 Clipboard Not Working**

- 🔐 **Solution**: Check system clipboard permissions

**❌ Input Error (Create Function)**

- 📝 **Solution**: Ensure input follows correct JSON or Plain Text format. Inline comments (`#` or `//`) are supported and will be ignored automatically.

**📄 Copy File Name Not Working**

- 📁 **Solution**: Make sure you've selected a valid local file (not a folder)

<hr style="border: 2px solid black; width: 100%; " />

## Contributing

Contributions are welcome. If you want to report a bug, suggest a feature, or help improve the extension, please read the contributor guide:

- [CONTRIBUTING.md](./CONTRIBUTING.md)

The guide covers setup, local checks, testing, pull request expectations, and dependency updates.

### Development package manager

Contributors must use **pnpm 12.21.0**. Enable Corepack with `corepack enable`, then install dependencies with `pnpm install --frozen-lockfile`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and development commands. `npm install` and `npm ci` are not supported for project dependencies.

<hr style="border: 2px solid black; width: 100%; " />

## License

MIT License — see [LICENSE](./LICENSE) for details

<hr style="border: 2px solid black; width: 100%; " />

## Contact

🐛 **Found a bug?** 🚀 **Have a feature request?**

Open an issue on our [GitHub repository](https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues)

<hr style="border: 2px solid black; width: 100%; " />

<p align="center">
  <strong>Made with ❤️ for developers worldwide 🌍</strong>
</p>

> ⭐ If this extension helped you, please consider giving it a star on the [GitHub](https://github.com/ShreyPurohit/folder-structure-pro-vscode/) and marketplace!

> ✨ Love this project? Sponsor me to help fuel more open-source work!
