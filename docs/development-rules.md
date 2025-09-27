# Development Rules

Follow these rules to keep delivery smooth and maintain quality.

---

## Recommended Workflow

1. **Start from the latest `main` branch**
   - Run `git pull origin main` before you begin and periodically during development so you resolve differences early.

2. **Implement in small steps and self-review**
   - Confirm requirements or ticket conditions and commit in small increments.
   - Read through your diff before requesting review and perform a self-check.

3. **Run the necessary quality checks**
   - Only run checks for the areas you actually changed.
   - Execute the following as needed:
     - Backend: `pytest backend/tests`
     - Frontend: `cd frontend && npm test` (Karma uses Chromium configured with `CHROME_BIN=/usr/bin/chromium-browser`).
     - Code formatting: `black --check` (limit to the files you modified).
     - Static analysis: `ruff check` (limit to the files you modified).
     - Frontend formatting: `cd frontend && npm run format:check` (limit to the files you modified).
     - Build: `cd frontend && npm run build`
   - If you only changed comments or documentation, you may skip tests, formatting, and builds—but run them whenever the change might affect code.
   - When any check fails, fix the issue and rerun the required checks until everything passes.

4. **Keep documentation current**
   - Update `README.md` and the materials under `docs/` to reflect the latest specifications and rules.
   - Double-check that the documents remain consistent.

5. **Capture screenshots for UI changes**
   - Preview the UI with `cd frontend && npm start` and take screenshots.
   - Attach the images to the merge request and add annotations when needed.

6. **Rebase on the latest `main` before completion**
   - Run `git fetch origin main && git merge origin/main` (or rebase) near the end of the task.
   - Resolve any conflicts and rerun builds or tests as necessary.

### Codex workflow limitations

- GitHub workflow runs triggered by issues or comments created by external contributors cannot access repository secrets such as `OPENAI_API_KEY`.
- When the Codex automation fails for that reason, a maintainer with write access must re-run the workflow manually via **Run workflow** so the job can use the required secrets.

---

## Pre-merge Requirements

1. **Finish the checks appropriate for the change**
   - **Code changes** → All required quality checks must pass.
   - **Comment or documentation-only changes** → Quality checks are optional; focus on content accuracy.

2. **Bring in the latest `main`**
   - Resolve every conflict.
   - After resolving conflicts, rerun builds and tests when needed.

3. **Conflict resolution rules**
   - Unresolved conflicts block merging.
   - After resolving, verify functionality and rerun checks if required.

4. **Expectations for UI updates**
   - Capture screenshots that cover relevant screen sizes and states.
   - Provide side-by-side comparisons when possible so reviewers can easily see the differences.

```json
{
  "development_rules": {
    "workflow": [
      "Pull the latest main branch at the start and during development to resolve differences early.",
      "Confirm requirements, commit in small increments, and perform self-review.",
      "Re-read your diff before requesting review and complete a self-check."
    ],
    "quality_checks": {
      "normal_changes": {
        "backend_tests": "pytest backend/tests",
        "frontend_tests": "cd frontend && npm test",
        "formatting": [
          "black --check (only changed files)",
          "cd frontend && npm run format:check (only changed files)"
        ],
        "lint": "ruff check (only changed files)",
        "build": "cd frontend && npm run build",
        "rules": [
          "Run only the checks required for the affected areas.",
          "Fix issues and rerun every required check until they pass."
        ]
      },
      "doc_or_comment_changes": {
        "skip_checks": true,
        "rules": [
          "You may skip tests, formatting, and builds when only documentation or comments change.",
          "Run the normal checks if the documentation change might affect code behavior."
        ]
      }
    },
    "documentation_and_ui": [
      "Keep README.md and docs/ aligned with the latest specifications.",
      "Preview UI changes, capture screenshots, and attach them to the merge request.",
      "Capture every relevant screen variation and share before/after comparisons."
    ],
    "pre_merge_requirements": {
      "normal_changes": [
        "All required checks must pass for code changes."
      ],
      "doc_or_comment_changes": [
        "Documentation-only or comment-only changes do not require automated checks; focus on accuracy."
      ],
      "common": [
        "Sync with the latest main and resolve any conflicts.",
        "Rerun builds or tests after resolving conflicts when needed.",
        "Always provide screenshots when UI changes are present."
      ]
    }
  }
}
```
