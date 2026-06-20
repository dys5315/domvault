# Git hooks

`pre-commit` blocks accidentally committing real notes into the public repo (the
`template/` content folders must stay empty). Enable once per clone:

```bash
git config core.hooksPath .githooks
```

Override for a deliberate commit with `git commit --no-verify`.
