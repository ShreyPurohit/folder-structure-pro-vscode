# Folder Structure Pro CLI

**Generate, copy, export, and create directory structures right from your terminal.**

Folder Structure Pro makes it easy to view and share your project's folder structure without manually writing it out.

Use the interactive menu or run commands directly. Whether you want to copy a folder tree, save it as a file, or create a directory structure from an existing one, the CLI has you covered.

## Features

- **Interactive mode** – Choose what you want to do through a simple terminal menu.
- **Copy to clipboard** – Copy your folder structure with a single command.
- **Export** – Save your structure as a plain text or JSON file.
- **Create** – Recreate directories and files from a previously exported structure.
- **Flexible filtering** – Exclude specific files and folders, include hidden entries, or respect `.gitignore`.
- **Control the depth** – Limit how many directory levels you want to include.

![Folder Structure Pro CLI interactive preview](https://raw.githubusercontent.com/ShreyPurohit/folder-structure-pro-vscode/main/assets/Folder-Structure-Pro-CLI.png)

## Requirements

- Node.js `>=22.14.0`

## Getting started

### Run without installing

Want to try Folder Structure Pro without installing it globally? Run it directly using your package runner.

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

These commands fetch and run the package when needed. You don't need to install it globally.

### Install globally (optional)

If you plan to use Folder Structure Pro regularly, you can install it globally.

**Using npm:**

```bash
npm install -g folder-structure-pro
```

**Using pnpm:**

```bash
pnpm add -g folder-structure-pro
```

Then run:

```bash
folder-structure-pro
```

## Interactive mode

Simply run the command without any arguments:

```bash
folder-structure-pro
```

Choose an action, select the directory to scan, adjust filtering options, and decide where the structure should go.

The CLI takes care of the rest.

> Interactive mode requires a terminal that supports prompts. When using a non-interactive environment, provide an explicit command instead.

## Commands

### 1. Copy a folder structure

Copy the generated structure directly to your clipboard.

```bash
folder-structure-pro copy [directory] [options]
```

Examples:

```bash
# Copy the current directory
folder-structure-pro copy

# Copy a specific directory
folder-structure-pro copy ./src

# Copy as JSON, limit depth, and exclude folders
folder-structure-pro copy . --format json --depth 3 --exclude dist --exclude coverage
```

The directory defaults to your current working directory.

### 2. Export a folder structure

Save the generated structure to a file or print it to standard output.

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

### 3. Create a folder structure

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

# Skip files that already exist
folder-structure-pro create structure.json --format json --to . --yes --on-conflict skip
```

The destination defaults to the current working directory and must already exist.

Choose how existing files should be handled with `--on-conflict`:

| Option           | Behavior                                              |
| ---------------- | ----------------------------------------------------- |
| `fail` (default) | Stop if conflicting files are found.                  |
| `skip`           | Keep existing files and create the remaining entries. |
| `replace`        | Replace existing regular files with empty files.      |

The `--yes` option is required for direct creation. Replacing files requires both `--yes` and `--on-conflict replace`.

## Filtering options

Use these options with `copy` and `export` to control what gets included:

| Option                  | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `--format <text\|json>` | Output format. Defaults to `text`.                      |
| `--depth <number>`      | Maximum directory depth. Unlimited when omitted.        |
| `--exclude <pattern>`   | Exclude files or directories. Can be repeated.          |
| `--hidden`              | Include hidden files and directories.                   |
| `--no-gitignore`        | Disable root `.gitignore` filtering.                    |
| `--output <file\|->`    | Export destination. `-` writes the structure to stdout. |
| `--force`               | Allow export to overwrite an existing regular file.     |

Additional behavior:

- `node_modules` is always excluded.
- Hidden files and directories are excluded by default.
- Root `.gitignore` rules are respected by default.
- Multiple `--exclude` patterns can be supplied.
- Directory symlinks are not traversed, and a symbolic-link scan root is rejected.

## Help

Need a quick reminder of available commands and options?

```bash
folder-structure-pro --help
```

You can also get help for an individual command:

```bash
folder-structure-pro copy --help
folder-structure-pro export --help
folder-structure-pro create --help
```

## Exit codes

| Code | Meaning                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| `0`  | Success, help, or interactive cancellation.                                    |
| `1`  | Execution, validation, filesystem, or clipboard failure.                       |
| `2`  | Invalid command or arguments, or non-interactive invocation without a command. |

## Limitations and safety notes

- Only the root `.gitignore` is used. Nested ignore-file rules are not supported.
- Export does not create missing parent directories.
- The destination directory for `create` must already exist.
- Creation is not atomic. If an operation fails partway through, previously completed changes may remain. The CLI does not roll back or recursively delete user data.
- Existing directories, symlinks, and entries with unknown metadata are never replaced during creation.
- Filesystem checks cannot eliminate every possible race involving concurrent path changes.

## License

[MIT](LICENSE) © Shrey Purohit

If you find Folder Structure Pro useful, consider giving the project a star on GitHub!

[GitHub Repository](https://github.com/ShreyPurohit/folder-structure-pro-vscode)
