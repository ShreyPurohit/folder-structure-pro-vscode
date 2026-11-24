# CLI flows

What the `folder-structure-pro` CLI asks and decides, in three parts. GitHub renders the diagrams.

1. [Overview](#1-overview): everything from the top, and where each command leads.
2. [Copy flow](#2-copy-flow): what happens when the structure is copied to the clipboard.
3. [Create flow](#3-create-flow): how a structure is turned into folders and files.

| Colour | Meaning                                |
| ------ | -------------------------------------- |
| Blue   | A question the user answers            |
| Green  | Success                                |
| Yellow | Done, but the result cannot be checked |
| Grey   | Cancelled by the user, nothing changed |
| Red    | Error                                  |

Exit codes: **0** success, help, or cancelled. **1** the operation failed. **2** the command or its options were wrong.

These diagrams are written by hand from the code. When the behaviour changes, update them too.

## 1. Overview

Code: `packages/cli/src/arguments.ts` (reading the command), `packages/cli/src/cli.ts` (`runExecutable`, `runDirectCommand`, `runCli`).

```mermaid
---
config:
  layout: elk
---
flowchart TD
    classDef ask fill:#e3f2fd,stroke:#1565c0,color:#0d3c73
    classDef ok fill:#d4edda,stroke:#2e7d32,color:#14401a
    classDef cancel fill:#eeeeee,stroke:#757575,color:#333333
    classDef err fill:#f8d7da,stroke:#c62828,color:#5c1018
    classDef flow fill:#ede7f6,stroke:#5e35b1,color:#2a1a5e

    START(["Run folder-structure-pro"]) --> ARGS{"What was typed after it?"}

    ARGS -- "Nothing" --> TTY{"Interactive terminal?"}
    TTY -- No --> E2(["Exit 2: use an explicit command"]):::err
    TTY -- Yes --> MENU["What would you like to do?"]:::ask

    ARGS -- "--help" --> HELP(["Show the help, exit 0"]):::ok
    ARGS -- "Unknown command or wrong options" --> E2B(["Exit 2: explain, point to --help"]):::err

    ARGS -- "copy" --> COPYF[["Copy flow"]]:::flow
    ARGS -- "create file, or create -" --> CREATEF[["Create flow"]]:::flow
    ARGS -- "export --output ..." --> OUT{"Output is - ?"}
    OUT -- "Yes" --> STDOUT(["Print the structure, exit 0"]):::ok
    OUT -- "No, a file" --> EXISTS{"File already exists?"}
    EXISTS -- "No, or --force given" --> SAVED(["Saved to the file, exit 0"]):::ok
    EXISTS -- "Yes, no --force" --> E1(["Exit 1: use --force to replace it"]):::err

    MENU -- "Copy or export a folder structure" --> ASKS["Questions: folder, format, filters,<br/>ignore patterns, depth"]:::ask
    MENU -- "Create directories and empty files" --> CREATEF
    ASKS --> SCAN["Scan the folder, show a preview"]
    SCAN --> WHERE{"Where should the structure go?"}:::ask
    WHERE -- "Copy to clipboard" --> COPYF
    WHERE -- "Print it here<br/>offered over SSH" --> PRINTED(["Printed, exit 0"]):::ok
    WHERE -- "Export to a file" --> PATH["Ask for the file path<br/>ask before overwriting"]:::ask
    PATH --> WROTE(["Saved, exit 0<br/>or cancelled if you refuse to overwrite"]):::ok

    NOTE["At any question: Esc or Ctrl+C<br/>cancels, exit 0, nothing changed"]:::cancel
```

## 2. Copy flow

What happens after you ask for a copy, from the interactive menu or from `folder-structure-pro copy`.

Code: `packages/cli/src/adapters/clipboard.ts` (the decisions), `packages/cli/src/adapters/nativeClipboard.ts` (the system tools), `packages/cli/src/adapters/terminalIdentity.ts` (recognising GNOME Terminal).

```mermaid
---
config:
  layout: elk
---
flowchart TB
    classDef ask fill:#e3f2fd,stroke:#1565c0,color:#0d3c73
    classDef ok fill:#d4edda,stroke:#2e7d32,color:#14401a
    classDef warn fill:#fff3cd,stroke:#b8860b,color:#5d4300
    classDef cancel fill:#eeeeee,stroke:#757575,color:#333333
    classDef err fill:#f8d7da,stroke:#c62828,color:#5c1018

    START(["Copy requested"]) --> SSH{"Plain SSH session?<br/>no forwarded display"}

    SSH -- "No: local, or ssh -X" --> TOOL["Use the system clipboard tool"]
    TOOL --> TOOLOK{"Did it work?"}
    TOOLOK -- Yes --> COPIED(["Copied, exit 0<br/>confirmed"]):::ok
    TOOLOK -- No --> VTE

    SSH -- "Yes" --> VTE{"Is the terminal GNOME Terminal<br/>or another VTE terminal?"}
    VTE -- "Yes: it ignores copy requests" --> FAIL["Copy not possible<br/>the reasons are listed"]
    VTE -- "No, or unknown" --> SEND{"Can the copy be sent<br/>to the terminal?"}
    SEND -- No --> FAIL
    SEND -- Yes --> SENT(["Sent, exit 0<br/>unconfirmed: paste to check"]):::warn

    FAIL --> MODE{"How was it started?"}
    MODE -- "folder-structure-pro copy" --> E1(["Exit 1<br/>reasons and a hint to print or save"]):::err
    MODE -- "Interactive menu" --> ASK{"What would you like to do instead?"}:::ask
    ASK -- "Print it here" --> PRINTED(["Printed, exit 0"]):::ok
    ASK -- "Save it to a file" --> SAVED(["Saved, exit 0"]):::ok
    ASK -- "Cancel" --> CANCEL(["Cancelled, exit 0"]):::cancel
```

What the system clipboard tool is:

| Where you run it  | Tool tried                                |
| ----------------- | ----------------------------------------- |
| macOS             | `pbcopy`                                  |
| Windows           | PowerShell, then `clip.exe`               |
| WSL               | The Windows tools above                   |
| Linux, Wayland    | `wl-copy`                                 |
| Linux, X11        | `xclip`, `xsel`, then Python 3 with GTK   |
| Plain SSH session | None. The server's clipboard isn't yours. |

Good to know:

- Over plain SSH the terminal is asked first. In the interactive menu, a GNOME Terminal is recognised before the question, so "Copy to clipboard" is left out of the menu.
- After "Sent" on a Linux desktop where no tool was found, the message also suggests installing `xclip`, `xsel` or `wl-clipboard`.
- Over SSH to a macOS or Windows machine, that machine's own clipboard is never used. A copy that only reached the server is not reported as "Copied".

## 3. Create flow

What happens after **Create directories and empty files**, or `folder-structure-pro create <file or ->`. The same checks run in both. The direct command asks no questions: it needs `--yes`, and any problem stops with exit 1 before anything is created.

Code: `packages/cli/src/cli.ts` (`collectStructure`, `runStructureCreation`), `packages/core/src/structureInput.ts` (reading and checking the structure), `packages/core/src/creation.ts` (safety checks and creation), `packages/cli/src/adapters/editor.ts`.

```mermaid
---
config:
  layout: elk
---
flowchart TD
    classDef ask fill:#e3f2fd,stroke:#1565c0,color:#0d3c73
    classDef ok fill:#d4edda,stroke:#2e7d32,color:#14401a
    classDef cancel fill:#eeeeee,stroke:#757575,color:#333333
    classDef err fill:#f8d7da,stroke:#c62828,color:#5c1018
    classDef flow fill:#ede7f6,stroke:#5e35b1,color:#2a1a5e

    START(["Create requested"]) --> GET[["Get the text<br/>see the next diagram"]]:::flow
    GET --> CHECK{"Can every line be read?"}
    CHECK -- No --> SHOW["Show the line numbers and text of each problem"]
    SHOW --> FIX{"Fix it in the editor?"}:::ask
    FIX -- Yes --> REOPEN["Reopen the editor with the same text<br/>and a note about each problem"]
    REOPEN --> SAVEDQ{"Was text saved?"}
    SAVEDQ -- Yes --> CHECK
    SAVEDQ -- No --> GET
    FIX -- No --> CANCEL1(["Cancelled, exit 0"]):::cancel

    CHECK -- Yes --> DEST["Ask for the destination folder"]:::ask
    DEST --> SAFE{"Is it an existing folder,<br/>and are all paths safe?"}
    SAFE -- No --> E1(["Exit 1: the problem is named<br/>nothing is created"]):::err
    SAFE -- Yes --> PREVIEW["Show the preview"]

    PREVIEW --> CLASH{"Would existing files<br/>be affected?"}
    CLASH -- Yes --> CHOOSE{"Replace, skip or cancel?"}:::ask
    CHOOSE -- "Replace or skip" --> CONFIRM
    CHOOSE -- "Cancel" --> CANCEL2(["Cancelled, exit 0<br/>nothing changed"]):::cancel
    CLASH -- No --> CONFIRM{"Create this structure?"}:::ask

    CONFIRM -- No --> CANCEL2
    CONFIRM -- Yes --> MAKE["Create folders and empty files"]
    MAKE --> DONE{"Did every step work?"}
    DONE -- Yes --> OK(["Done, exit 0<br/>created, reused, replaced, skipped"]):::ok
    DONE -- "No, or Ctrl+C" --> UNDO["Undo the run: remove what it created,<br/>restore replaced files"]
    UNDO --> E1B(["Exit 1: nothing was changed<br/>or the paths that could not be undone"]):::err
```

### Getting the text

Used by the first step above. Anything that can't be used goes back to the question "Where is the structure?"

```mermaid
---
config:
  layout: elk
---
flowchart TD
    classDef ask fill:#e3f2fd,stroke:#1565c0,color:#0d3c73
    classDef ok fill:#d4edda,stroke:#2e7d32,color:#14401a
    classDef warn fill:#fff3cd,stroke:#b8860b,color:#5d4300
    classDef err fill:#f8d7da,stroke:#c62828,color:#5c1018

    Q["Where is the structure?"]:::ask
    Q -- "On my clipboard<br/>only when this session can read it" --> CLIP{"Is there text on it?"}
    Q -- "I will paste it in a text editor" --> EDITOR["Open the editor<br/>save and close when done"]
    Q -- "In a file" --> FILE["Ask for the path"]:::ask

    CLIP -- Yes --> TEXT(["Got the text, now check it"]):::ok
    CLIP -- "No, or it can't be read" --> BACK1["Say why"]:::warn
    BACK1 --> Q

    EDITOR --> EDOK{"What happened?"}
    EDOK -- "Text was saved" --> TEXT
    EDOK -- "Nothing was entered" --> BACK2["Say so"]:::warn
    EDOK -- "No editor is installed" --> BACK3["Say how to set EDITOR"]:::warn
    EDOK -- "The editor failed" --> E1(["Exit 1: editor error"]):::err
    BACK2 --> Q
    BACK3 --> Q

    FILE --> FILEOK{"A regular file<br/>that exists?"}
    FILEOK -- Yes --> TEXT
    FILEOK -- No --> E1B(["Exit 1: file error"]):::err
```

Direct command: `create -` reads the text from standard input, `create <file>` reads the file. The format (text or JSON) is detected from the content unless `--format` is given.
