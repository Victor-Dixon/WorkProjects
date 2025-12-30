## Documentation cleanup (Dream OS / repo hygiene)

This repository’s active code is primarily:
- `terminal_organizer/` (Python CLI)
- `isolation_api/` and `isolation_proof/` (isolation demo + FastAPI service)
- small demo apps (`battle-tetris/`, `journal-app/`)

Over time, a large set of **one-off planning / resume / external website audit** markdown files accumulated in the repo root. They were not referenced by the code, not required to run the projects, and made navigation noisy.

### What was deleted

The following root-level documentation files were removed because they were **off-topic** for this repository’s maintained projects:

- `ADMIN_ACCESS_FIXES.md`
- `ADMIN_ACCESS_SECURITY_CHECK.md`
- `blog-post-learning-journey.md`
- `COMPLETE_AUDIT_SUMMARY.md`
- `COMPREHENSIVE_RESUME.md`
- `CRITICAL_SECURITY_ISSUE.md`
- `DEVELOPER_PROFILE.md`
- `EXECUTION_PLAN.md`
- `FREERIDEINVESTOR_SECURITY_AUDIT.md`
- `GITHUB_TOKEN_REVOCATION_GUIDE.md`
- `IMPROVEMENT_PLAN.md`
- `NEXT_STEPS_ACTION_PLAN.md`
- `PORTFOLIO_SUMMARY.md`
- `PROFESSIONAL_REVIEW.md`
- `RESUME_EXAMPLES.md`
- `SECURITY_AUDIT.md`
- `SWARM_WEBSITE_SECURITY_AUDIT.md`
- `UPDATED_PRIORITIES.md`
- `WEBSITES_RESUME_EXAMPLES.md`

Note: if you still need any of these, they should live in a separate “personal-docs” repository or a `docs/archive/` folder, not the main project root.

### How it was deleted

The deletion was done as normal source-control removals (equivalent to `git rm <file>`), so the files are removed from the repository history going forward but still retrievable from past commits if needed.

