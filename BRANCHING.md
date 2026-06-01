# Branching & deploy policy

## Production

- The current Netlify production branch is shown under Netlify > Project configuration > Build & deploy > Branches and deploy contexts.
- As of 2026-05-14 the production branch is `claude/fix-home-page-errors-6kVi6`. The target end state is `main`; the flip is described in DEPLOYMENT_CHECKLIST.md.
- Netlify auto-deploys every push to the production branch to https://lusikandsons.com.
- No force-push. No direct push if you can avoid it. Land changes via PR.

## Branch naming

| Prefix | Meaning | Deploy behavior |
|---|---|---|
| `main` | Intended production trunk (target state) | Netlify deploys production from here after the flip |
| `feat/*`, `fix/*`, `docs/*` | Human work branches | PR-only; Netlify builds a deploy preview per PR |
| `claude/*` | Transient working branches from Claude sessions | PR-only; no branch deploy unless added to the allow-list |
| `agent-*` | Transient working branches from the Netlify coding agent | PR-only; no branch deploy unless added to the allow-list |

Netlify branch-deploys are now restricted to an allow-list (only `main` is in it). Claude/agent branches still get deploy previews when they open a PR against the production branch.

## Pull request flow

1. Open PR against the production branch.
2. Netlify builds a Deploy Preview at a unique URL.
3. Owner reviews the preview and smoke-tests Stripe checkout (test mode) before merging.
4. Merge (squash or rebase; no force-push).
5. Netlify production build runs automatically.
6. Owner verifies https://lusikandsons.com still loads and checkout works.

## Required local checks before opening a PR

Defined in `package.json`:

```bash
npm ci
npm run next:build
npm run typecheck
npm run test:unit
npm run test:e2e
```

Latest results are captured in `IMPLEMENTATION_REPORT.md`.

## Stale branches

See `GITHUB_ORGANIZATION_PLAN.md` (produced by the infrastructure audit) for the candidate-for-cleanup list. Prefer archiving as tags (`archive/<branch>`) before deletion.

## Strict rules

- Never commit secrets, env vars, or API keys to any branch.
- Never force-push or rewrite history on a published branch.
- Never delete a branch that Netlify is deploying from.
- Never merge a PR that touches Stripe code without a test-mode checkout run.
