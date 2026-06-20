---
description: Turn a ChatGPT data export into per-conversation notes + a MOC
---
Run the **Chat ingestion workflow** from `CLAUDE.md`:
`python3 00-inbox/_scripts/chatgpt_ingest.py $ARGUMENTS 70-learning/chats`
Then do the enrichment pass: real summaries, key takeaways, topic tags, cross-link into MOCs.
All notes start status: inbox, tagged #review.
