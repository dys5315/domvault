---
title: RAG Searches Under the Streetlight (Coverage Is the Hidden Failure)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, rag, retrieval, ai-engineering, coverage]
---

# RAG Searches Under the Streetlight (Coverage Is the Hidden Failure)

> A retrieval system can only ever return answers from where the light is — the slice of the world
> that got chunked, embedded, and indexed. The danger is that the search feels exhaustive from
> inside the light.

## The connection
The streetlight effect is the drunk-under-the-lamppost joke turned into an epistemics rule: people
search where the light is convenient, not where the answer actually is. A RAG pipeline does the
same thing, structurally rather than psychologically. It can only return answers from where the
light is — the slice of the world that got chunked, embedded, and written into the index. The lamp
is the index; everything outside it is dark.

The dangerous part is the same as the human bias: **the search feels exhaustive from inside the
light.** A nearest-neighbour query always returns *something* — the top-k closest vectors — even
when the real answer was never indexed. The system can't tell "the answer isn't in the corpus"
apart from "the answer is in the corpus but I didn't retrieve it" apart from "I retrieved the
closest thing, which is wrong." All three look like a confident result.

So the streetlight effect names a failure mode that standard RAG metrics miss. Precision and recall
on retrieved chunks measure how well you search *under the lamp*. They say nothing about how much of
the answerable world is outside it. Coverage — what's indexed vs. what exists — is the invisible
axis.

## Why it matters
The moment a corpus answers its own questions, every gap — an un-ingested document, a note never
linked, a topic thought about but never written down — becomes a dark patch the retriever will
confidently route around. Retrieval silence reads as "there's nothing on this," when it often means
"this isn't under the lamp yet."

## So what
- Add a **coverage signal** to retrieval, separate from relevance score: when a query's best
  matches all fall below a similarity floor, surface *index gap detected — answer may be outside the
  corpus* rather than returning weak matches as authoritative.
- Apply a margin of safety: discount your own confident estimate.
- Log every query whose top hit is weak; that log *is* the map of where your light doesn't reach,
  and it tells you what to ingest next.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*
