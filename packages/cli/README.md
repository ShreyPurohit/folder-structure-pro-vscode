# Folder Structure Pro CLI

**Generate, copy, export, and recreate project folder structures from your terminal.**

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
- [Command Options](#command-options)
- [Filtering Behavior](#filtering-behavior)
- [Exit Codes](#exit-codes)
- [Limitations and Safety](#limitations-and-safety)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- Node.js `>=22.14.0`

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

Choose an action from the menu, select the directory to scan, adjust filtering options, and decide where the generated structure should go.

The CLI guides you through the process.

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

## Exit Codes

| Code | Meaning                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| `0`  | Success, help, or interactive cancellation.                                    |
| `1`  | Execution, validation, filesystem, or clipboard failure.                       |
| `2`  | Invalid command or arguments, or non-interactive invocation without a command. |

## Limitations and Safety

- Only the root `.gitignore` is used. Nested ignore-file rules are not supported.
- Export does not create missing parent directories.
- The destination directory for `create` must already exist.
- Creation is not atomic. If an operation fails partway through, previously completed changes may remain.
- The CLI does not roll back changes or recursively delete user data.
- Existing directories, symlinks, and entries with unknown metadata are never replaced during creation.
- Filesystem checks cannot eliminate every possible race involving concurrent path changes.

## Contributing

Folder Structure Pro is open source, and contributions are welcome!

You can help by reporting bugs, suggesting features, improving documentation, or submitting code.

Before contributing, please read the [Contributing Guide](../../CONTRIBUTING.md) for development setup, testing instructions, and the pull request process.

- [Report a bug](https://github.com/ShreyPurohit/folder-structure-pro-vscode/issues)
- [Start a discussion](https://github.com/ShreyPurohit/folder-structure-pro-vscode/discussions)
- [View the Contributing Guide](../../CONTRIBUTING.md)

## License

[MIT](LICENSE) © Shrey Purohit

---

If Folder Structure Pro saves you time, consider giving the project a star on [GitHub](https://github.com/ShreyPurohit/folder-structure-pro-vscode).
