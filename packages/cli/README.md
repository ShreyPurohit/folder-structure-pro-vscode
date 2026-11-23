# Folder Structure Pro CLI

**Generate, copy, export, and recreate project folder structures from your terminal.**

[![npm version](https://img.shields.io/npm/v/folder-structure-pro)](https://www.npmjs.com/package/folder-structure-pro)
[![npm downloads](https://img.shields.io/npm/dw/folder-structure-pro)](https://www.npmjs.com/package/folder-structure-pro)
[![CI](https://github.com/ShreyPurohit/folder-structure-pro-vscode/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ShreyPurohit/folder-structure-pro-vscode/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/ShreyPurohit/folder-structure-pro-vscode)](./LICENSE)

Folder Structure Pro helps you view, share, and recreate directory structures without manually writing them out.

Whether you need to share your project structure with an AI assistant, document your files, or recreate a directory layout in another location, Folder Structure Pro makes it simple.

Use the interactive menu or run commands directly from your terminal.

## Features

- **Interactive mode** – Choose what you want to do through a simple terminal menu.
- **Copy to clipboard** – Copy a folder structure with a single command.
- **Export** – Save your structure as a plain text or JSON file.
- **Create** – Recreate directories and empty files from an exported structure.
- **Flexible filtering** – Exclude specific files and folders, include hidden entries, or respect `.gitignore`.
- **Depth control** – Limit how many directory levels you want to include.
- **Works over SSH** – Copy from a remote server straight to your own clipboard, with a clear message if your terminal can't.
- **No runtime dependencies** – Nothing extra is installed alongside it.

![Folder Structure Pro CLI interactive preview](https://raw.githubusercontent.com/ShreyPurohit/folder-structure-pro-vscode/main/assets/Folder-Structure-Pro-CLI.png)

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
    - [Interactive Mode](#interactive-mode)
    - [Copy a Folder Structure](#copy-a-folder-structure)
    - [Export a Folder Structure](#export-a-folder-structure)
    - [Create a Folder Structure](#create-a-folder-structure)
- [Clipboard and SSH](#clipboard-and-ssh)
- [Command Options](#command-options)
- [Filtering Behavior](#filtering-behavior)
- [Troubleshooting](#troubleshooting)
- [Exit Codes](#exit-codes)
- [Limitations and Safety](#limitations-and-safety)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- Node.js `>=22.14.0`
- Copying to the clipboard on a Linux desktop needs one of `xclip`, `xsel` or `wl-clipboard`. macOS and Windows need nothing extra, and neither does copying over SSH. See [Clipboard and SSH](#clipboard-and-ssh).

## Installation

### Run without installing globally

You can try Folder Structure Pro directly using a package runner. No global installation is required.

**Using npm:**

```bash
npx folder-structure-pro
```

**Using pnpm (recommended):**

```bash
pnpm dlx folder-structure-pro
```

You can also use `pnpx`, the older pnpm equivalent:

```bash
pnpx folder-structure-pro
```

### Install globally

If you plan to use the CLI regularly, install it globally.

**Using npm:**

```bash
npm install -g folder-structure-pro
```

**Using pnpm:**

```bash
pnpm add -g folder-structure-pro
```

After installation, run:

```bash
folder-structure-pro
```

## Quick Start

To copy the current project's folder structure to your clipboard:

```bash
folder-structure-pro copy
```

To export it as a text file:

```bash
folder-structure-pro export . --output folder-structure.txt
```

To recreate a structure from an exported file:

```bash
folder-structure-pro create structure.txt --format text --to ./new-project --yes
```

The destination directory for `create` must already exist.

## Usage

### Interactive Mode

Run the CLI without any arguments:

```bash
folder-structure-pro
```

The CLI walks you through these steps:

1. Choose **Copy or export a folder structure** or **Create directories and empty files**.
2. Pick the directory to scan. Press `Tab` to autocomplete folder names.
3. Choose the output format and filters, and optionally a maximum depth.
4. Review the preview, then choose where the structure goes: your clipboard or a file.

If the structure can't be copied to the clipboard, the CLI shows why and offers to print it in the terminal (so you can select and copy it by hand) or save it to a file.

Press `Esc` or `Ctrl+C` at any prompt to cancel without making changes.

> Interactive mode requires a terminal that supports prompts. In non-interactive environments, use an explicit command instead.

### Copy a Folder Structure

Copy a generated folder structure directly to your clipboard.

```bash
folder-structure-pro copy [directory] [options]
```

Examples:

```bash
# Copy the current directory
folder-structure-pro copy

# Copy a specific directory
folder-structure-pro copy ./src

# Copy as JSON
folder-structure-pro copy . --format json

# Limit depth and exclude folders
folder-structure-pro copy . --depth 3 --exclude dist --exclude coverage
```

The directory defaults to your current working directory.

If the copy can't be done on your machine, see [Clipboard and SSH](#clipboard-and-ssh).

### Export a Folder Structure

Save a generated folder structure to a file or print it to standard output.

```bash
folder-structure-pro export [directory] --output <file|->
```

Examples:

```bash
# Export to a text file
folder-structure-pro export . --output folder-structure.txt

# Export as JSON
folder-structure-pro export . --format json --output structure.json

# Print the structure to stdout
folder-structure-pro export . --output -

# Overwrite an existing regular file
folder-structure-pro export . --output folder-structure.txt --force
```

The output directory must already exist. Existing files are not overwritten unless you explicitly pass `--force`.

### Create a Folder Structure

Create directories and empty files from a previously exported text or JSON structure.

```bash
folder-structure-pro create <structure-file> --format <text|json> --yes [options]
```

Examples:

```bash
# Create from a text structure
folder-structure-pro create structure.txt --format text --to ./new-project --yes

# Create from a JSON structure
folder-structure-pro create structure.json --format json --to ./new-project --yes

# Skip entries that already exist
folder-structure-pro create structure.json --format json --to . --yes --on-conflict skip
```

The destination defaults to your current working directory and must already exist.

Use `--on-conflict` to decide what happens when an entry already exists:

| Option           | Behavior                                                |
| ---------------- | ------------------------------------------------------- |
| `fail` (default) | Stop when conflicting entries are found.                |
| `skip`           | Keep existing entries and create the remaining entries. |
| `replace`        | Replace existing regular files with empty files.        |

The `--yes` option is required for direct creation. Replacing files requires both `--yes` and `--on-conflict replace`.

## Clipboard and SSH

### What the CLI uses

| Where you run it        | What it uses                  | Install anything?   |
| ----------------------- | ----------------------------- | ------------------- |
| macOS                   | `pbcopy`                      | No                  |
| Windows                 | PowerShell, or `clip.exe`     | No                  |
| WSL                     | The Windows tools above       | No                  |
| Linux desktop (X11)     | `xclip`, or `xsel`            | Yes, one of them    |
| Linux desktop (Wayland) | `wl-copy`                     | Yes, `wl-clipboard` |
| Termux (Android)        | `termux-clipboard-set`        | Termux:API          |
| SSH session or server   | Your own terminal (see below) | No                  |

On Debian and Ubuntu, `sudo apt install xclip` is enough for a Linux desktop.

### Copying over SSH

A server has no access to the clipboard on your own computer. So over SSH, the CLI asks your terminal to set the clipboard for it. This uses a standard terminal feature called OSC 52, and you don't need to install anything on the server.

Your terminal decides whether to allow it:

- **Usually supported:** Windows Terminal, iTerm2 (turn on "Applications in terminal may access clipboard"), kitty, WezTerm, Alacritty and foot.
- **Known not to support it:** GNOME Terminal, the macOS Terminal app, and PuTTY by default.
- **Inside tmux:** add `set -g allow-passthrough on` to your `~/.tmux.conf`.

A terminal never reports whether it accepted the copy. So the CLI prints "Sent" instead of "Copied", and you should paste once to check. If the paste is empty, use [`export`](#export-a-folder-structure) to save the structure to a file instead.

Structures larger than about 75 KB are not sent through the terminal, because many terminals drop long messages. Use `export` for those.

## Command Options

### Copy and Export

These options control which files and directories are included in the generated structure.

| Option                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `--format <text\|json>` | Output format. Defaults to `text`.                                |
| `--depth <number>`      | Maximum directory depth. Unlimited when omitted.                  |
| `--exclude <pattern>`   | Exclude files or directories matching a pattern. Can be repeated. |
| `--hidden`              | Include hidden files and directories.                             |
| `--no-gitignore`        | Disable root `.gitignore` filtering.                              |

### Export Only

| Option               | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `--output <file\|->` | Export destination. Use `-` to write the structure to stdout. |
| `--force`            | Allow overwriting an existing regular file.                   |

### Create Only

| Option                                | Description                                                       |
| ------------------------------------- | ----------------------------------------------------------------- |
| `--format <text\|json>`               | Format of the input structure.                                    |
| `--to <directory>`                    | Destination directory. Defaults to the current working directory. |
| `--yes`                               | Confirm direct creation without an interactive confirmation.      |
| `--on-conflict <fail\|skip\|replace>` | Decide how to handle existing entries. Defaults to `fail`.        |

## Filtering Behavior

Folder Structure Pro applies the following rules while scanning a directory:

- `node_modules` is always excluded.
- Hidden files and directories are excluded by default.
- Root `.gitignore` rules are respected by default.
- Multiple `--exclude` patterns can be supplied.
- Directory symlinks are not traversed.
- A symbolic-link scan root is rejected.

Use `--hidden` to include hidden entries or `--no-gitignore` to disable root `.gitignore` filtering.

## Troubleshooting

| What you see                                                       | What it means                                                             | What to do                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Sent … to your terminal's clipboard.` followed by an empty paste  | Your terminal ignored the copy request.                                   | Use a terminal that supports OSC 52, or run `folder-structure-pro export . --output tree.txt`. |
| `No clipboard tool found. Install xclip, xsel or wl-clipboard`     | You're on a Linux desktop without a clipboard tool.                       | Run `sudo apt install xclip` (or your distribution's equivalent).                              |
| `No desktop session found` or `This server has no desktop session` | There is no graphical session, such as a plain SSH server or a container. | Run it from a terminal that supports OSC 52, or use `export`.                                  |
| `No terminal is available to send the copy to.`                    | The CLI is running without a terminal, for example in a script or a pipe. | Use `export . --output -` to print the structure, or `export --output <file>` to save it.      |

To get the structure out of a server without using the clipboard, print it and select it with your mouse:

```bash
folder-structure-pro export . --output -
```

## Exit Codes

| Code | Meaning                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| `0`  | Success, help, or interactive cancellation.                                    |
| `1`  | Execution, validation, filesystem, or clipboard failure.                       |
| `2`  | Invalid command or arguments, or non-interactive invocation without a command. |

## Limitations and Safety

- Only the root `.gitignore` is used. Nested ignore-file rules are not supported.
- Copying over SSH cannot be confirmed, because terminals don't report whether they accepted the copy.
- Export does not create missing parent directories.
- The destination directory for `create` must already exist.
- Creation is not atomic. If an operation fails partway through, previously completed changes may remain.
- The CLI does not roll back changes or recursively delete user data.
- Existing directories, symlinks, and entries with unknown metadata are never replaced during creation.
- Filesystem checks cannot eliminate every possible race involving concurrent path changes.

## Contributing

Folder Structure Pro is open source, and contributions are welcome!

You can help by reporting bugs, suggesting features, improving documentation, or submitting code.

Before contributing, please read the [Contributing Guide](https://github.com/ShreyPurohit/folder-structure-pro-vscode/blob/main/CONTRIBUTING.md) for development setup, testing instructions, and the pull request process.

- [Report a bug](https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues)
- [Start a discussion](https://github.com/ShreyPurohit/folder-structure-pro-vscode/discussions)
- [View the Contributing Guide](https://github.com/ShreyPurohit/folder-structure-pro-vscode/blob/main/CONTRIBUTING.md)

## License

[MIT](LICENSE) © Shrey Purohit

---

If Folder Structure Pro saves you time, consider giving the project a star on [GitHub](https://github.com/ShreyPurohit/folder-structure-pro-vscode).
