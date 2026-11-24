# Change Log

## [0.2.0] - 2026-11-24

### Added

- Creation is all or nothing. If a step fails or you press Ctrl+C while files are being created, everything that run created is removed and replaced files are restored. Before, a failure could leave part of the structure behind.
- Create from more places. The interactive menu now asks where the structure is: your clipboard (local sessions), a text editor you paste into (works over SSH and with large structures), or a file.
- `create -` reads the structure from standard input, for example `pbpaste | folder-structure-pro create - --to ./new-project --yes`.
- `--format` is optional for `create`. Text or JSON is detected from the content.
- Pasted text no longer needs the `Directory structure:` heading, and Windows line endings are accepted. When a structure can't be read, the CLI shows the line numbers and text, and **Fix it in the editor** reopens it with notes about what was wrong.
- GNOME Terminal and other VTE-based terminals are recognised, also through SSH (the CLI asks the terminal which program it is). Because they ignore copy requests, the CLI says so, leaves "Copy to clipboard" out of the menu, and offers printing or saving instead.
- Over SSH, the interactive menu offers "Print it here to select and copy", which works in every terminal.

### Fixed

- Copying on Linux desktops without `xclip`, `xsel` or `wl-copy` (a fresh Ubuntu, for example) works again in terminals that ignore the terminal clipboard, such as GNOME Terminal. It now falls back to Python 3 with GTK when available.
- When you paste a structure in the editor on a server without a working UTF-8 locale, the tree's box characters are now shown correctly instead of as escape codes. The text was always saved correctly.
- Ubuntu's first-time "Select an editor" menu no longer appears when the editor opens. The system default editor is used.
- Over SSH to a macOS or Windows machine, the CLI no longer copies to that machine's own clipboard and reports "Copied".

### Changed

- When a copy can't be confirmed, the message now shows the command that prints the structure: `folder-structure-pro export . --output -`.

## [0.1.1] - 2026-11-23

### Added

- Copying over SSH or on a machine without a desktop session now falls back to the terminal clipboard (OSC 52), so the structure can reach your local clipboard without `xsel`, `xclip` or `wl-copy` on the server. Works through tmux.
- In the interactive flow, when no clipboard route works, you can now print the structure to the terminal or save it to a file instead of ending with an error.
- npm releases are published from GitHub Actions with provenance.
- Interactive mode: directory prompts now autocomplete folders (press Tab), a spinner shows while the folder is scanned, and a missing structure file is reported immediately so you can correct the path instead of the run ending.

### Changed

- This removes `clipboardy` and its transitive dependencies from the CLI package.
- Clipboard failures are explained in plain language, one reason per line, including which clipboard tool to install on Linux (for example, `sudo apt install xclip`).
- The success message says "Sent … to your terminal's clipboard" when the copy could not be confirmed, with a hint to use `export --output` if the paste is empty.
- Over SSH, the CLI now asks your local terminal emulator to update its clipboard first, rather than attempting to copy to the remote machine's clipboard. A forwarded X11 or Wayland display on Linux is still used.

## [0.1.0] - 2026-11-23

### Added

- Initial release: `copy`, `export` and `create` commands, plus an interactive menu, for folder structures in Plain Text and JSON.
