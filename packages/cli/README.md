# Folder Structure Pro CLI

The CLI supports interactive and direct `copy`, `export`, and `create`
operations. The package is `folder-structure-pro@0.1.0`; it remains private
(`private: true`) and has not been published to npm. It declares Node.js
`>=22.14.0`. CI validates Node.js 22.14.0 with the dedicated Ubuntu CLI
package-validation job. The test matrix runs on Node.js 24 for Windows, Ubuntu,
and macOS. The declared minimum has been validated for package validation on
Ubuntu; Node.js 24 has been tested across the three operating systems. Other
Node.js and platform combinations have not been validated.

## Build and run

From the repository root:

```sh
pnpm --filter folder-structure-pro build
node packages/cli/dist/index.js
```

To validate the package, run:

```sh
pnpm --filter folder-structure-pro run validate-package
```

This builds the CLI, packs a local tarball, installs it into an isolated
temporary npm consumer, and exercises the installed executable. This local
consumer validation does not publish the package. The test suite also runs the
installed-package test in the Node.js 24 Windows, Ubuntu, and macOS matrix.
Invocation through `npx`, `pnpm dlx`, or a global installation has not been
validated.

With no arguments, a TTY opens the interactive menu. In non-TTY use, provide an
explicit command; otherwise the CLI exits with status 2 instead of prompting.
Explicit commands never prompt.

## Commands

### Copy to the clipboard

```sh
folder-structure-pro copy [directory] [options]
```

```sh
folder-structure-pro copy . --format json --depth 3 --exclude dist --exclude coverage
folder-structure-pro copy src --hidden --no-gitignore
```

The directory defaults to the current working directory. `--format` accepts
`text` or `json` (default: `text`); `--depth` is a non-negative whole number;
`--exclude` can be repeated; `--hidden` includes hidden entries; and
`--no-gitignore` disables root `.gitignore` filtering. `node_modules` remains
excluded. Clipboard failures are reported on stderr and never redirect the
structure to another destination. Clipboard access may be unavailable in
headless Linux environments; use `export --output <file>` to write it to a
file or `export --output -` to write the structure to stdout instead.

### Export to a file or stdout

```sh
folder-structure-pro export [directory] --output <file|->
```

```sh
folder-structure-pro export . --output folder.txt
folder-structure-pro export src --format json --output -
folder-structure-pro export . --output folder.txt --force
```

The scan options are the same as `copy`. `--output` is required; `-` writes
only the structure (and its trailing newline) to stdout. Diagnostics go to
stderr. The output parent must already exist. Existing regular files are
refused unless `--force` is supplied; directories, symlinks, and entries with
unknown metadata are not overwritten. The check and write are separate:
`--force` cannot prevent a concurrent path replacement (including a symlink
swap) between validation and writing.

### Create from a structure file

```sh
folder-structure-pro create <structure-file> --format <text|json> --yes [options]
```

```sh
folder-structure-pro create structure.txt --format text --to ./new-project --yes
folder-structure-pro create structure.json --format json --to . --yes --on-conflict skip
folder-structure-pro create structure.txt --format text --to . --yes --on-conflict replace
```

The destination defaults to the current working directory and must already
exist. Plain text keeps the existing parser contract: its first line is an
ignored header, followed by tree entries. JSON uses the shared core parser.
Invalid input, unsafe names, duplicate paths, type collisions, and unsupported
destination metadata fail before creation.

`--yes` is required for every direct creation. `--on-conflict` accepts:

- `fail` (default): stop without changes if existing file conflicts are found.
- `skip`: keep existing file contents and create other planned entries.
- `replace`: replace existing regular files with empty files. Directories,
  symlinks, and entries with unknown metadata are never replaced.

Replacement therefore requires both `--on-conflict replace` and `--yes`.
Creation is not atomic; completed operations may remain after a later failure.
The CLI does not roll back or recursively delete user data.

## Help and exit codes

Use `folder-structure-pro --help` or append `--help` to a command for its
options and examples.

- `0`: success, help, or interactive cancellation.
- `1`: execution, validation, filesystem, or clipboard failure.
- `2`: invalid command/arguments or non-TTY invocation without a command.

## Filtering behavior

- Hidden files and directories are excluded by default; `--hidden` includes
  them without disabling explicit exclusions or `.gitignore`.
- `node_modules` remains excluded.
- Root `.gitignore` rules are respected by default and can be disabled with
  `--no-gitignore`.
- Repeated `--exclude` patterns are additive.
- Maximum depth is optional and unlimited when omitted.
- Directory symlinks are not traversed; a symbolic-link scan root is rejected.

## Limitations

- Only the root `.gitignore` is used, matching shared-core behavior; nested
  ignore-file semantics are not implemented.
- Export does not create parent directories.
- Node filesystem checks and writes cannot eliminate all time-of-check/time-of-
  use races. In particular, `export --force` checks the target before writing,
  but a concurrent path replacement (including a symlink swap) can change the
  write target between those operations. Creation revalidates planned paths,
  but operations are not a race-free or atomic tree transaction.
- The destination directory is not created implicitly.
- Configuration files, dry-run, shell completion, and batch status summaries
  are not implemented.
