# Contributing to Domvault

Thanks for wanting to make the engine better. A few ground rules keep this healthy.

## What belongs here
- Improvements to the **engine**: templates, workflows, scripts, agent instructions, the registry spec, the Constellation app.
- Docs, examples, fixes.

## What does NOT belong here
- **Your actual notes.** This is a public repo. The `template/` folder ships empty by design. Never commit real vault content.
- Anything that adds telemetry, silent sync, or non-consensual data collection. PRs that do this will be rejected on principle (see the privacy contract in the README).

## Attribution & licensing
By contributing you agree your contribution is licensed under the repo's [PolyForm Noncommercial 1.0.0](LICENSE). You keep copyright on your contribution; you grant the project the right to use it under that license.

## Constellation nodes
If you publish nodes to Constellation, you keep ownership and attribution. Publishing is opt-in and revocable. Don't publish other people's private content.

## PR checklist
- [ ] No real/private notes committed
- [ ] No new network calls in the base engine
- [ ] Docs updated if behavior changed
- [ ] `./plugin/install.sh /tmp/test-brain` still scaffolds cleanly
