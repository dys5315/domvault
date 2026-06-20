---
title: A Linked Vault Wants to Be a Graph RAG
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, ai-engineering, knowledge-graph, rag, second-brain]
galaxy: [ai-engineering, knowledge]
planet_id: planet_cc614e00367ea06913c4d49287c0f5b7dd1805c2
---

# A Linked Vault Wants to Be a Graph RAG

> A linked note vault is already a hand-built knowledge graph. Most graph-RAG systems build the
> graph *graph-last* by extraction; a curated vault was built *graph-first* by hand — and that
> inversion is the advantage.

## The connection
A linked note vault is a **knowledge graph**: nodes (notes) + typed edges (wiki-links), with hub
notes, origin-colored authorship, and synthesis notes bridging clusters. That's not a metaphor —
it's literally the substrate every "Graph RAG" system tries to construct from scratch. The road from
*static graph* to *queryable second brain* runs through two architectures: **Graph RAG** (retrieve
over entity/relationship structure, not flat text) and **Agentic RAG** (an agent with memory +
planning orchestrates multi-step retrieval). The vault's links *are* the graph edges Graph RAG
needs; the hub notes are pre-built entry nodes.

## Why it matters
The vault was built **graph-first by hand** (you wrote the edges); RAG systems are usually built
**graph-last by extraction** (an LLM guesses the edges from a text dump). That inversion is an
advantage: retrieval quality is bounded by edge quality, and curated, origin-tagged, deliberately
bridged edges are far richer than auto-extracted ones. So the missing piece isn't structure, it's
the **retrieval + agent layer**: a vector index for semantic recall, graph traversal that follows
links and hub membership (not just cosine similarity), and an agent loop with memory that plans
multi-hop queries across clusters.

## So what
- Point a Graph-RAG retriever at the vault: semantic search to find seed notes, then traverse links
  + shared hubs one or two hops to assemble context, then answer.
- Treat synthesis notes as high-value "bridge" context — they connect clusters, so they pull the
  most cross-domain signal into an answer.
- It compounds the existing loop: the synthesis pass *writes* edges; a retrieval layer *reads* them.
  Together that's a brain that both forms and recalls connections.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*



