# 08 — The Publish Rubric (what goes in the public repo)

> This rubric is **composed from the brain's own frameworks**. Going public is safe only if you
> can decide, per note, whether sharing it helps you or hands a competitor a moat. So we built a
> grader for exactly that — using the same primitives the brain already trusts.

## The frameworks it's built from
- **The Rubric Pattern** — *"define a fixed, weighted, explainable scoring scheme and grade
  against ground truth; never trust output on faith."* → the rubric *is* the decision.
- **FMEA = the Rubric Pointed at Failure** — *RPN = Severity × Occurrence × Detection.* The
  failure mode here is **leaking a moat**, so we score it as an RPN.
- **Moat Analysis ("the algorithm is not the asset")** — the methodology/engine is commodity and
  safe to share; the **accumulated curated graph + integrated flywheel + live venture playbooks**
  are the defensible assets. This is the whole reason engine-public / content-private works.
- **Price the Lift, Not the Work** — also score the **value created for others** (community lift
  → reputation + network effects), not just the risk.
- **The Holdout Rule / Goodhart's Law Is Overfitting** — a rubric you optimize against gets
  gamed. So the rubric is **advisory, never automatic**: a human reviews a holdout sample before
  anything is published.

## The five dimensions (score each 1–5)

| Dim | Question | 1 (low) | 5 (high) |
|-----|----------|---------|----------|
| **S — Moat Severity** | If a competitor copied this, how much damage? | pure teaching/mental model | core defensible asset (curated graph data, integrated flywheel, live playbook) |
| **O — Exploitability** | How usable is it to a rival *as-is*? | abstract idea | turnkey (costed pricing, JV splits, named clients, working code) |
| **D — Undetectability** | If leaked, how hard to prove it's yours / catch misuse? | trivially provable (signed/published) | untraceable once out |
| **L — Community Lift** | Value created for others if shared? | none | high teaching value / drives network effects |
| **G — Genericizability** | Can venture specifics be stripped while keeping the lift? | no | yes, cleanly |

## The score

```
Moat-Leak Risk (RPN) = S × O × D        # FMEA; higher = more dangerous to publish
Community Lift        = L                 # Price-the-Lift
```

Plot each note on Risk (RPN) vs Lift:

```
 Lift │  GENERICIZE         PUBLISH
  high│  (strip specifics,  (share as-is,
      │   then publish)      attribution on)
      │
   low│  HOLD               HOLD / archive
      │  (private)          (low value anyway)
      └─────────────────────────────────────
            high RPN            low RPN
```

Decision rule:
- **RPN low + Lift high → PUBLISH** (with attribution).
- **RPN high + Lift high + G=yes → GENERICIZE** (publish the stripped version; keep the original private).
- **RPN high + (G=no or Lift low) → HOLD** (stays in your private vault forever).
- **Lift low + RPN low → optional** (publish only if it adds polish; otherwise skip).

## Auto-fail triggers (from the Rubric Pattern's hard gates)
Regardless of score, a note is **HOLD** if it contains any of:
- client / patient / partner names, or anything PHI-adjacent
- live pricing numbers, JV/revenue splits, or unpublished financials
- credentials, keys, endpoints, or infra detail
- a direct map of your own moat (e.g. a "what's proprietary here" analysis)

## The holdout gate (anti-gaming — non-negotiable)
The rubric is a proxy; optimizing it blindly is overfitting (Goodhart). So:
1. The rubric **never auto-publishes**. It produces a recommendation.
2. **You review a holdout** — every note within ±1 RPN of the threshold, plus a random 10–20%
   sample — before anything is pushed.
3. Constellation's `/publish` flow enforces this at runtime: it shows a diff and waits for your
   confirm. Publishing is opt-in by construction (see `registry/SPEC.md`).

## Output
Running the rubric produces a scored inventory with a PUBLISH / GENERICIZE / HOLD verdict per
note. Keep that inventory **private** (it names your real notes). The template lives at
`docs/_templates/publish-rubric.csv`.
