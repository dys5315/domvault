# 06 — IP & licensing (plain English)

> Not legal advice — I'm not a lawyer. This explains the choices so you can decide. For anything
> high-stakes, run it past an actual attorney.

## Your actual concern
You want to share the **engine/frameworks** with a friend (and maybe a community) without
letting anyone (a) resell it as their own or (b) take credit for it — especially since pieces of
it may feed real companies later.

There are two separate protections, and you need both:

### 1. Protect the *content* with secrecy
The strongest protection for proprietary venture material is **not publishing it**. Domvault is
built so your notes never enter the public repo (`template/` ships empty; `.gitignore` blocks
real brains). Trade-secret protection only survives if you actually keep it secret. So: share
the engine, keep your venture notes private.

### 2. Protect the *engine* with a license
A license is how you let people use the engine while keeping rights. The only real question:
**can others make money off it?**

| Option | Others can use/learn | Others can sell it / build a paid product on it | You keep commercial rights | Best when |
|--------|:--:|:--:|:--:|---|
| **PolyForm Noncommercial 1.0.0** *(chosen)* | ✅ | ❌ (need your permission) | ✅ | You may commercialize later and want to block free-riders |
| MIT / Apache-2.0 | ✅ | ✅ (must keep your credit) | ✅ (non-exclusive) | You want maximum adoption / community |
| AGPL-3.0 | ✅ | ✅ but their version must also be open-sourced | ✅ | You want it to stay open everywhere |

**This repo ships PolyForm Noncommercial 1.0.0** because it matches your stated goal: your
friend and the community can freely use, study, modify, and share the engine for non-commercial
purposes, **but nobody can sell it or fold it into a commercial product without your written
permission**, and your name stays on it. You keep every commercial right yourself.

Swapping later is easy: replace `LICENSE` and the README badge. Going *more* permissive later is
painless; going *more* restrictive after people adopt it is hard — so starting restrictive is the
safe default.

## Attribution that can't be stripped
- The license **requires** keeping the `Required Notice` copyright line.
- Constellation nodes are **content-addressed and signed**, so authorship is provable and forks
  carry lineage back to the origin (`registry/SPEC.md` §5).

## Practical checklist before you push to GitHub
- [ ] Confirm `template/` contains no real notes (it doesn't, by design).
- [ ] Confirm `.gitignore` excludes any local test brain.
- [ ] Enable the pre-commit guard: `git config core.hooksPath .githooks`
- [ ] Add a `CONTRIBUTOR LICENSE` note if you accept PRs (CONTRIBUTING.md covers this).
- [ ] Decide: public repo, or private repo shared only with your friend? (You can start private
      and open it later.)
- [ ] If a venture later commercializes the engine, you grant *yourself* a commercial license —
      no conflict, since you hold the rights.
