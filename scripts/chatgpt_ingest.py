#!/usr/bin/env python3
"""
chatgpt_ingest.py — Turn a ChatGPT data export (`conversations.json`) into structured
Markdown notes in the second brain.

Each conversation -> one note with:
  - frontmatter (status, created/updated from the chat's own timestamps, type: chat,
    origin: ai-ingested, source: chatgpt, tags)
  - a Summary section + Key takeaways  (LLM if a summarizer is wired; heuristic otherwise)
  - the full transcript, role-labeled, in a collapsible block

Also writes a "ChatGPT Chats — MOC.md" index.

How to get the input:
  ChatGPT -> Settings -> Data controls -> Export data -> (email) -> unzip -> conversations.json

Usage:
  python3 chatgpt_ingest.py /path/to/conversations.json /path/to/vault/70-learning/chats
"""

from __future__ import annotations
import sys, os, re, json, html
from datetime import datetime, timezone

# ---- optional LLM summarizer (wire to any client; heuristic fallback used if None) ----
def summarize(title: str, transcript: str, llm_client=None) -> tuple[str, list[str]]:
    """Return (summary_paragraph, [key_takeaways]). Replace stub with your LLM call."""
    if llm_client is not None:
        prompt = ("Summarize this ChatGPT conversation in 2-3 sentences, then list 3-6 key "
                  "takeaways as bullets. Respond as JSON "
                  '{"summary":"...","takeaways":["...","..."]}.\n\n'
                  f"TITLE: {title}\n\nTRANSCRIPT:\n{transcript[:12000]}")
        try:
            j = json.loads(llm_client(prompt))
            return j.get("summary", ""), j.get("takeaways", [])
        except Exception:
            pass
    # heuristic fallback: first user ask + simple extractive takeaways
    first_user = ""
    for line in transcript.splitlines():
        if line.startswith("**You:**"):
            first_user = line.replace("**You:**", "").strip(); break
    summary = (f"Conversation about: {title}." + (f' Opening ask: "{first_user[:200]}"' if first_user else ""))
    return summary, []

def slugify(s: str, maxlen: int = 60) -> str:
    s = re.sub(r"[^\w\s-]", "", s.lower()).strip()
    s = re.sub(r"[\s_]+", "-", s)
    return (s[:maxlen].rstrip("-")) or "untitled"

def epoch_to_date(ts) -> str:
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d")

def linearize(mapping: dict, current_node: str) -> list[dict]:
    """Walk parent links from the leaf to root, return ordered [{role, text}]."""
    msgs, node = [], current_node
    guard = 0
    while node and guard < 10000:
        guard += 1
        n = mapping.get(node) or {}
        m = n.get("message")
        if m:
            role = (m.get("author") or {}).get("role")
            text = _content_to_text(m.get("content") or {})
            if role in ("user", "assistant") and text.strip():
                msgs.append({"role": role, "text": text})
        node = n.get("parent")
    return list(reversed(msgs))

def _content_to_text(content: dict) -> str:
    ctype = content.get("content_type", "")
    parts = content.get("parts", [])
    out = []
    for p in parts:
        if isinstance(p, str):
            out.append(p)
        elif isinstance(p, dict):
            # multimodal / tool parts — capture text if present, note non-text
            if p.get("text"):
                out.append(p["text"])
            elif p.get("content_type", "").startswith("image"):
                out.append("[image]")
    txt = "\n".join(out).strip()
    if ctype == "code" and txt:
        txt = f"```\n{txt}\n```"
    return txt

def render_transcript(msgs: list[dict]) -> str:
    lines = []
    for m in msgs:
        who = "**You:**" if m["role"] == "user" else "**ChatGPT:**"
        lines.append(f"{who} {m['text']}\n")
    return "\n".join(lines)

def main(src: str, outdir: str, owner: str = "dom", llm_client=None):
    """owner = whose ChatGPT account this export is from. Used for provenance + namespacing.
    Notes for a non-'dom' owner are kept separate and should NOT feed Dom's Interests Profile."""
    owner = owner.strip().lower() or "dom"
    owner_slug = slugify(owner, 30)
    data = json.load(open(src, encoding="utf-8"))
    convs = data if isinstance(data, list) else data.get("conversations", [data])
    os.makedirs(outdir, exist_ok=True)
    index, n_written, n_empty = [], 0, 0
    for i, conv in enumerate(convs, 1):
        title = (conv.get("title") or f"Untitled chat {i}").strip()
        mapping = conv.get("mapping") or {}
        leaf = conv.get("current_node")
        if not leaf:  # fall back to any node without children
            leaf = next((k for k, v in mapping.items() if not (v or {}).get("children")), None)
        msgs = linearize(mapping, leaf) if leaf else []
        if not msgs:
            n_empty += 1
            continue
        created = epoch_to_date(conv.get("create_time"))
        updated = epoch_to_date(conv.get("update_time") or conv.get("create_time"))
        transcript = render_transcript(msgs)
        summary, takeaways = summarize(title, transcript, llm_client)
        idx = f"{i:03d}"
        fname = f"{idx}-{slugify(title)}.md"
        tk = "\n".join(f"- {t}" for t in takeaways) if takeaways else "- _(add on review)_"
        moc_name = "ChatGPT Chats — MOC" if owner_slug == "dom" else f"ChatGPT Chats ({owner}) — MOC"
        owner_tags = "" if owner_slug == "dom" else f", external, owner-{owner_slug}"
        consent_line = "" if owner_slug == "dom" else (
            f"\n> ⚠️ **External chats — owner: {owner}.** Ingested with consent for reference. "
            f"May contain that person's / third-party private info. Do NOT use to derive Dom's Interests Profile.\n")
        note = f"""---
status: inbox
created: {created}
updated: {updated}
type: chat
origin: ai-ingested
source: chatgpt
chat-owner: {owner}
tags: [chatgpt, chats, review{owner_tags}]
turns: {len(msgs)}
---

# {title}
{consent_line}
> {summary}

## Key takeaways
{tk}

## Full transcript
<details>
<summary>{len(msgs)} messages — click to expand</summary>

{transcript}
</details>

## Related
- [[{moc_name}]]
"""
        open(os.path.join(outdir, fname), "w", encoding="utf-8").write(note)
        index.append((created, title, fname[:-3], len(msgs)))
        n_written += 1

    # MOC
    index.sort(reverse=True)
    today = datetime.now().strftime("%Y-%m-%d")
    moc_title = "ChatGPT Chats — MOC" if owner_slug == "dom" else f"ChatGPT Chats ({owner}) — MOC"
    is_ext = owner_slug != "dom"
    header = (f"> Conversations from {'**' + owner + '** (external account, ingested with consent)' if is_ext else 'Dom'}'s "
              f"ChatGPT data export. {n_written} chats. All tagged `#review` until triaged."
              + ("\n>\n> ⚠️ External chats — keep separate from Dom's own notes; do not feed the Interests Profile." if is_ext else ""))
    related = "\n## Related\n- [[Learning Hub]]\n" + ("" if is_ext else "- [[Dom — Interests Profile]]\n")
    moc = [f"""---
status: active
created: {today}
updated: {today}
type: moc
origin: ai-generated
chat-owner: {owner}
tags: [moc, chatgpt, chats{'' if not is_ext else ', external'}]
cssclass: graph-hub
graph-group: hub
---

# {moc_title}

{header}

## Chats (newest first)
"""]
    for created, title, base, turns in index:
        moc.append(f"- {created} — [[{base}|{title}]] · {turns} msgs")
    moc.append(related)
    open(os.path.join(outdir, f"{moc_title}.md"), "w", encoding="utf-8").write("\n".join(moc))

    print(f"Wrote {n_written} chat notes ({n_empty} empty/skipped) for owner='{owner}' to {outdir}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python3 chatgpt_ingest.py <conversations.json> <output_dir> [owner]")
        print("  owner: whose account the export is from (default 'dom'). Non-dom = external, namespaced + walled off.")
        sys.exit(1)
    owner = sys.argv[3] if len(sys.argv) > 3 else "dom"
    main(sys.argv[1], sys.argv[2], owner=owner)
