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
- **Create** – Recreate directories and empty files from a structure on your clipboard, pasted in your editor, in a file, or piped in. A preview comes first, and you confirm before anything is created.
- **Flexible filtering** – Exclude specific files and folders, include hidden entries, or respect `.gitignore`.
- **Depth control** – Limit how many directory levels you want to include.
- **Works over SSH** – Copy from a remote server straight to your own clipboard, or print the structure when your terminal can't.
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
- Copying needs nothing extra on macOS, Windows, WSL or most Linux desktops. See [Clipboard and SSH](#clipboard-and-ssh) for the details.

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
folder-structure-pro create structure.txt --to ./new-project --yes
```

Or run `folder-structure-pro` and choose **Create directories and empty files** to paste a structure from your clipboard or an editor.

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

If the structure can't be copied, the CLI says why and offers to print it (so you can select it by hand) or save it to a file. See [Clipboard and SSH](#clipboard-and-ssh).

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

Create directories and empty files from a text tree or JSON structure, such as one you exported or copied earlier.

**Interactive:** run `folder-structure-pro`, choose **Create directories and empty files**, and pick where the structure is:

| Choice                           | What happens                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On my clipboard                  | Reads the structure you copied. Only offered when this session can read your clipboard, so not over SSH.                                                                           |
| I will paste it in a text editor | Opens your editor (`$VISUAL`, then `$EDITOR`, then the system default, `nano` or `vi`; Notepad on Windows). Paste the structure, save, and close. Works everywhere, including SSH. |
| In a file                        | Asks for the path of a saved structure. Press `Tab` to autocomplete file names.                                                                                                    |

The CLI then checks the structure, shows a preview of what will be created, and asks you to confirm. If something can't be read, it shows the line numbers and text and asks **Fix it in the editor?** Saying yes reopens your text, from the clipboard, the editor or the file, with notes about what was wrong.

**Direct:** pass a file, or `-` to read the structure from standard input:

```bash
folder-structure-pro create <structure-file|-> --yes [options]
```

Examples:

```bash
# Create from a file (text or JSON is detected automatically)
folder-structure-pro create structure.txt --to ./new-project --yes

# Create from your clipboard (on Windows, use the interactive menu instead)
pbpaste | folder-structure-pro create - --to ./new-project --yes                       # macOS
xclip -selection clipboard -o | folder-structure-pro create - --to ./new-project --yes  # Linux

# Force the format, and skip entries that already exist
folder-structure-pro create structure.json --format json --to . --yes --on-conflict skip
```

The destination defaults to your current working directory and must already exist.

Pasted text doesn't need the `Directory structure:` heading, and Windows line endings are fine.

Use `--on-conflict` to decide what happens when an entry already exists:

| Option           | Behavior                                                |
| ---------------- | ------------------------------------------------------- |
| `fail` (default) | Stop when conflicting entries are found.                |
| `skip`           | Keep existing entries and create the remaining entries. |
| `replace`        | Replace existing regular files with empty files.        |

The `--yes` option is required for direct creation. Replacing files requires both `--yes` and `--on-conflict replace`.

## Clipboard and SSH

### Where copying works

| Where you run it                                                                                                                        | What happens                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| macOS, Windows, WSL                                                                                                                     | Works. Nothing to install.                                                                                                                 |
| Linux desktop                                                                                                                           | Works with `xclip`, `xsel` or `wl-copy`. Without them, it uses Python 3 with GTK, which Ubuntu Desktop includes.                           |
| SSH, from a terminal that supports it (for example the Kiro or VS Code terminal, Windows Terminal, iTerm2, kitty, WezTerm or Alacritty) | Usually works. The copy goes to **your own** clipboard through your terminal. Some terminals need a setting turned on.                     |
| SSH, from GNOME Terminal (or another VTE-based terminal such as Tilix or Xfce Terminal)                                                 | Can't work. These terminals ignore copy requests. The CLI notices, says so, and offers **Print it here** and **Export to a file** instead. |
| SSH with `ssh -X`, and `xclip` or `xsel` on the server                                                                                  | Works. The server's display leads back to your desktop.                                                                                    |

Over SSH, the CLI asks your terminal to set the clipboard (a standard feature called OSC 52), so you don't install anything on the server. A terminal never confirms that it accepted the copy, so the CLI says **Sent** instead of **Copied**. Paste once to check.

On a Linux desktop, the GTK fallback runs a small background process that serves the clipboard until you copy something else, the same way `xclip` does.

### If copying doesn't work

Print the structure and select it with your mouse, or save it to a file:

```bash
folder-structure-pro export . --output -
folder-structure-pro export . --output tree.txt
```

In interactive mode, the CLI offers both choices when a copy fails. Over SSH, **Print it here to select and copy** is always in the destination menu.

Good to know:

- Installing `xclip` on a server doesn't help in a normal SSH session. It would set the server's clipboard, not yours. It only helps with `ssh -X`.
- Inside tmux, add `set -g allow-passthrough on` to your `~/.tmux.conf`.
- Structures larger than about 75 KB are not sent through the terminal, because many terminals drop long messages. Use `export` for those.

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

| Option                                | Description                                                            |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `--format <text\|json>`               | Format of the input structure. Detected from the content when omitted. |
| `--to <directory>`                    | Destination directory. Defaults to the current working directory.      |
| `--yes`                               | Confirm direct creation without an interactive confirmation.           |
| `--on-conflict <fail\|skip\|replace>` | Decide how to handle existing entries. Defaults to `fail`.             |

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

| What you see                                                      | What to do                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sent … to your terminal's clipboard.`, but pasting gives nothing | Your terminal ignored the request. Print the structure with `export . --output -`, or use a terminal from [the list above](#where-copying-works). |
| `GNOME Terminal and similar terminals can't receive a copy…`      | Use another terminal, or print or save the structure with `export`.                                                                               |
| `No clipboard tool found. Install xclip, xsel or wl-clipboard`    | On a Linux desktop, run `sudo apt install xclip` (or your distribution's equivalent).                                                             |
| `This server has no desktop session`                              | Normal over SSH. Use a terminal that supports copying, `ssh -X` with `xclip`, or `export`.                                                        |
| `No text editor found.`                                           | Set the `EDITOR` variable, for example `export EDITOR=nano`, or choose **In a file**.                                                             |
| `Nothing was entered.` after the editor closes                    | Your editor may open in a separate window and return at once. Use one that waits, for example `EDITOR="code --wait"`.                             |
| `No terminal is available to send the copy to.`                   | The CLI is running in a script or a pipe. Use `export --output <file>` or `--output -`.                                                           |

## Exit Codes

| Code | Meaning                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| `0`  | Success, help, or interactive cancellation.                                    |
| `1`  | Execution, validation, filesystem, or clipboard failure.                       |
| `2`  | Invalid command or arguments, or non-interactive invocation without a command. |

## Limitations and Safety

- Only the root `.gitignore` is used. Nested ignore-file rules are not supported.
- A copy over SSH can't be confirmed, because terminals don't report whether they accepted it.
- Export does not create missing parent directories.
- The destination directory for `create` must already exist.
- If a structure starts with a plain root line that has no connector, such as `proj/` in the output of the `tree` command, that line is skipped and its contents are created directly in the destination. A tree that starts with `└── proj/` creates the `proj` folder. The preview shows exactly what will be created.
- Creation is all or nothing. If a step fails, or you press Ctrl+C while files are being created, everything that run created is removed and replaced files are restored. A power cut or a forced kill (for example `kill -9`) can't be undone.
- Undoing only removes what the run itself created, and only empty directories. It never deletes recursively, so files someone else adds meanwhile are kept, and the CLI names any path it couldn't undo.
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
