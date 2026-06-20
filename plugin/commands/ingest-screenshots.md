---
description: OCR + file saved screenshots into 70-learning as structured notes
---
Follow the **Screenshot ingestion workflow** in `CLAUDE.md` exactly:
1. Inventory + dedupe images by md5.
2. For each substantive image, OCR/transcribe into `70-learning/<topic>/<NNN>-<slug>.md`.
3. Use the frontmatter + body sections specified in CLAUDE.md (origin: ai-ingested).
4. Copy downscaled images into `70-learning/attachments/` and embed them.
5. Update the relevant MOC. Junk → misc + tag `review`.

Source images path: $ARGUMENTS
