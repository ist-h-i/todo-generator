**Scope**
- Focus: i18n coverage of Board subtask cards and related UI strings.
- Result: Layout change is done; below are i18n findings and quick fixes.

**Mixed/Hardcoded Strings**
- Mixed languages in the same view:
  - English “Subtasks” vs. Japanese headings/descriptions: frontend/src/app/features/board/page.html:221
  - Status label “NonIssue” amid Japanese titles: frontend/src/app/features/board/page.ts:115
- Unmarked literals in template (add `i18n`):
  - Eyebrow/title/description/hint: frontend/src/app/features/board/page.html:221, frontend/src/app/features/board/page.html:222, frontend/src/app/features/board/page.html:223, frontend/src/app/features/board/page.html:225
  - Empty state: frontend/src/app/features/board/page.html:245
  - Parent/labels/due/assignee/effort labels: frontend/src/app/features/board/page.html:271, frontend/src/app/features/board/page.html:286, frontend/src/app/features/board/page.html:292, frontend/src/app/features/board/page.html:295
  - Counter suffix “件”: frontend/src/app/features/board/page.html:241
- Unmarked literals in code (use `$localize` or extract):
  - Quick filter labels/descriptions: frontend/src/app/features/board/page.ts:34–60
  - Priority labels: frontend/src/app/features/board/page.ts:66–71
  - Subtask status titles (including “NonIssue”): frontend/src/app/features/board/page.ts:111–116

**Variable Strings & Formats**
- Status names shown with `{{ column.title }}` depend on `SUBTASK_STATUS_META` titles; ensure localized source: frontend/src/app/features/board/page.html:265, frontend/src/app/features/board/page.ts:111–116.
- Date format `date: 'yyyy/MM/dd'` is acceptable for ja-JP but is fixed; consider localized token (e.g., `shortDate`) if multi-locale: frontend/src/app/features/board/page.html:286.
- Hours unit “h” should be translatable (e.g., `'h'` vs. `時間`): frontend/src/app/features/board/page.html:295.
- List separator for quick filter summary uses ASCII “, ”; for JA prefer “、” or use `Intl.ListFormat`: frontend/src/app/features/board/page.ts:210–217.

**Accessibility Strings**
- Consider explicit label for status for SRs (e.g., “ステータス: {{ column.title }}”) and mark for i18n: frontend/src/app/features/board/page.html:262–266.

**Locale Setup**
- App `lang` is `ja` (good): frontend/src/index.html:1.
- `@angular/localize` and extract target present; static strings in templates lack `i18n` markers (add `i18n`/`i18n-attr` and optional `@@ids`): frontend/angular.json:76–77.

**Recommendations**
- Add `i18n` attributes to the static template strings listed above, with descriptions and stable IDs.
- Replace TS literals with `$localize` (quick filters, priorities, subtask status titles) or load from a translation source.
- Localize list joining (use `Intl.ListFormat('ja')`) instead of `join(', ')`: frontend/src/app/features/board/page.ts:210–217.
- Parameterize units and counters (“件”, “h”) via translation entries; keep user-entered values unchanged.
- Ensure status titles come from localized data (avoid mixing English “NonIssue” in a Japanese locale).

**Non-Goals**
- Do not translate user content: `subtask.title`, `subtask.parentTitle`, `labelName(...)` remain as-is.