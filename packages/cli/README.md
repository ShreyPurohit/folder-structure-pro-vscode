# Folder Structure Pro CLI

The CLI currently provides interactive folder-structure copy/export and
directory-structure creation. Copy/export supports plain-text and JSON output,
clipboard copy, and UTF-8 file export. Creation reads the existing plain-text
tree or JSON structure formats and creates directories and empty files.

## Requirements

- Node.js `>=22.14.0`
- A terminal with interactive TTY input and output
- Clipboard access for the copy destination

## Local development

From the repository root, build and run the CLI:

```sh
pnpm --filter folder-structure-pro build
node packages/cli/dist/index.js
```

Choose whether to copy/export a structure or create one. Copy/export defaults
to the current working directory; select an output format and filtering
options, then copy to the clipboard or export to a file. Creation asks for an
input structure file and an existing destination directory, then shows a
bounded plan preview before asking for confirmation.

For example, a plain-text input begins with a header line (the parser ignores
the first line), followed by tree entries:

```text
Directory structure:
└── app/
    ├── index.ts
    └── README
```

JSON input uses nested objects for directories and string, string-array, or
`null` values for file entries. Both formats are parsed and validated by the
shared core. Invalid plain-text tree lines, unsafe names, duplicate paths,
type collisions, and unsupported destination metadata stop creation before
any filesystem changes.

Existing matching directories are reused. Existing regular files can be
skipped (preserving their contents) or explicitly replaced with empty files;
the complete operation must then be confirmed. Directories, symbolic links,
and entries with unknown metadata are never replaced.

## Filtering behavior

- Hidden files and directories are excluded by default; they can be included
  independently.
- `node_modules` remains excluded even when hidden entries are included.
- Root `.gitignore` rules are respected by default and can be disabled
  independently.
- Additional comma-separated ignore patterns are additive.
- Maximum depth is optional and unlimited when left blank.
- Directory symlinks are not traversed. A symlink selected as the scan root is
  rejected.

## Clipboard and file export

Clipboard access is provided by `clipboardy`; unavailable clipboard services
are reported as errors without claiming a successful copy.

Export requires the parent directory to exist. Existing regular files require
confirmation before replacement. New files are created exclusively to avoid
silently replacing a file that appears during the operation. Confirmed
overwrites use a normal write after a preflight check and are not atomic with
respect to concurrent filesystem changes. Exclusive creation protects the
filename, not the content write; a failed write may leave an incomplete file.

## Current limitations

- Interactive TTY use only; there are no non-interactive commands or flags.
- The preview is bounded and may show only the beginning of large structures.
- Only the root `.gitignore` is used, matching shared-core behavior.
- Export does not create parent directories.
- Creation is not atomic. A filesystem failure can leave completed earlier
  changes in place; automatic rollback is intentionally not attempted.
- Node filesystem checks and writes cannot eliminate all time-of-check/time-of-
  use races. The destination itself and planned entries are revalidated, but a
  concurrent change between validation and an operation can still affect it.
- The CLI does not create the destination directory. It supports interactive
  use only; batch processing, configuration files, and watch mode are not
  implemented.
