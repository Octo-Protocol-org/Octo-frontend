# Clipboard clearing for secrets

`CopyButton` accepts a `sensitive` prop. When set, the clipboard is overwritten with an
empty string 60 seconds after copying (or on unmount if still pending), but only if it
still holds the copied value, when reading the clipboard is permitted.

This is best-effort. It cannot remove entries from OS clipboard history or synced
clipboards (Windows Clipboard History, macOS universal clipboard, clipboard managers).
