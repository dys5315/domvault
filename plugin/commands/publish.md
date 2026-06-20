---
description: Opt-in publish selected notes to the Constellation registry
---
Follow `registry/SPEC.md`. For the note(s) in $ARGUMENTS:
1. Confirm each has `publish: true` (refuse otherwise).
2. Build the node manifest (id, title, author, license, links, content hash).
3. Show the user a DIFF of exactly what will leave the machine. Wait for confirmation.
4. Only then push to the registry. Record the returned planet id back in the note's frontmatter.
Never publish a note the user didn't explicitly select.
