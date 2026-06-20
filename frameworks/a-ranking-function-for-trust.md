---
title: A Ranking Function for Trust (BM25 as a Reputation Engine)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, information-retrieval, reputation, ranking, trust]
galaxy: [leadership]
planet_id: planet_5d32751606cde2a7cf6d4cfc34429756addaa984
---

# A Ranking Function for Trust (BM25 as a Reputation Engine)

> A 40-year-old search-ranking formula already encodes the fairness rules a reputation score needs.
> A defensible score is a product's trust primitive — and BM25 supplies the math for one.

## The connection
BM25 scores how relevant a document is to a query, and its design is built around three hard-won
corrections to naive counting:

1. **IDF — rarity is informative.** A term that appears everywhere tells you almost nothing; a rare
   term is a strong signal.
2. **Term-frequency saturation (`k1`).** The first occurrence matters a lot; the tenth barely moves
   the needle. Repetition has diminishing returns by design.
3. **Length normalization (`b`).** Long documents accumulate more matches, so BM25 discounts length
   so a verbose doc doesn't out-rank a tight one unfairly.

Read those three as the failure modes of a naive "average star rating" reputation score:
- **No rarity weighting** → a verified, hard-won review counts the same as a throwaway one. IDF
  says weight the *rare, informative* signal above the common noise.
- **No saturation** → ten 5-stars from one repeat source dominate. `k1` says saturate repeats from
  the same source so volume from one relationship can't manufacture reputation.
- **No normalization** → high-volume and selective participants can't be compared fairly, and busy
  ones get gamed or penalized. `b` says normalize for "document length" — here, volume, size, or
  recency window — so the score compares like with like.

## Why it matters
This is the same trust problem behind the rubric pattern: a defensible score is the product's trust
primitive. BM25 supplies the *math* for one — a ranking function whose parameters are tunable
fairness levers, not a black box.

## So what
- Spec any reputation score as a BM25-shaped ranking function, not a plain average: signal weight
  (IDF analogue), source saturation (`k1` analogue), normalization (`b` analogue).
- Down-weight common, easily-faked signals toward zero; cap the marginal contribution of repeated
  ratings from one source; decay old data.
- Expose `k1`/`b`-style knobs so the ranking can be tuned against gaming *and explained* to the
  people it ranks — which is itself a trust feature.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*



