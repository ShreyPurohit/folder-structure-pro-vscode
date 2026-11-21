# Folder Structure Pro CLI

The CLI currently provides an interactive folder-structure export workflow. It
supports plain-text and JSON output, clipboard copy, and UTF-8 file export.

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

The initial prompt uses the current working directory as its default target.
Choose an output format, filtering options, and then copy the result or export
it to a file.

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
- Structure creation, batch processing, configuration files, and watch mode
  are not implemented.
