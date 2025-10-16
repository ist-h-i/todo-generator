Plan: run the existing class-recipe generator to add only missing per-class/component recipes under docs/recipes/classes, excluding tests; verify idempotency and coverage.

What I did
- Used the existing generator to create missing per-class/component recipe stubs for Angular.
- Scope: frontend/src/app/**/*.ts (excludes *.spec.ts and test.ts).
- Verified idempotency (re-run produced no new files) and coverage vs “export class …” occurrences.

Commands run
- Generate missing class recipes:
  - python scripts/generate_class_recipes.py
- Sanity-check counts (classes vs recipes):
  - rg -n "^\s*export\s+class\s+(\w+)" frontend/src/app | wc -l
  - find docs/recipes/classes/frontend/src/app -type f -name "*.recipe.md" | wc -l

Files added (34)
- docs/recipes/classes/frontend/src/app/App.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/AdminApiService.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/AnalysisGateway.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/BoardLayoutsApiService.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/CardsApiService.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/CommentsApiService.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/CompetencyApiService.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/HttpErrorNotifierService.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/HttpLoadingStore.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/StatusReportsGateway.recipe.md
- docs/recipes/classes/frontend/src/app/core/api/WorkspaceConfigApiService.recipe.md
- docs/recipes/classes/frontend/src/app/core/auth/AuthService.recipe.md
- docs/recipes/classes/frontend/src/app/core/layout/hover-messages/HoverMessageComponent.recipe.md
- docs/recipes/classes/frontend/src/app/core/layout/hover-messages/HoverMessageStackComponent.recipe.md
- docs/recipes/classes/frontend/src/app/core/layout/shell/HelpDialogComponent.recipe.md
- docs/recipes/classes/frontend/src/app/core/layout/shell/Shell.recipe.md
- docs/recipes/classes/frontend/src/app/core/logger/Logger.recipe.md
- docs/recipes/classes/frontend/src/app/core/profile/ProfileDialogComponent.recipe.md
- docs/recipes/classes/frontend/src/app/core/profile/ProfileService.recipe.md
- docs/recipes/classes/frontend/src/app/core/state/ContinuousImprovementStore.recipe.md
- docs/recipes/classes/frontend/src/app/core/state/WorkspaceStore.recipe.md
- docs/recipes/classes/frontend/src/app/features/admin/AdminPage.recipe.md
- docs/recipes/classes/frontend/src/app/features/analytics/AnalyticsPage.recipe.md
- docs/recipes/classes/frontend/src/app/features/analyze/AnalyzePage.recipe.md
- docs/recipes/classes/frontend/src/app/features/auth/login/LoginPage.recipe.md
- docs/recipes/classes/frontend/src/app/features/board/BoardPage.recipe.md
- docs/recipes/classes/frontend/src/app/features/profile/evaluations/ProfileEvaluationsPage.recipe.md
- docs/recipes/classes/frontend/src/app/features/reports/ReportAssistantPageComponent.recipe.md
- docs/recipes/classes/frontend/src/app/features/settings/SettingsPage.recipe.md
- docs/recipes/classes/frontend/src/app/shared/pipes/LocalDateTimePipe.recipe.md
- docs/recipes/classes/frontend/src/app/shared/ui/NotFoundPage.recipe.md
- docs/recipes/classes/frontend/src/app/shared/ui/page-header/PageHeaderComponent.recipe.md
- docs/recipes/classes/frontend/src/app/shared/ui/page-layout/PageLayoutComponent.recipe.md
- docs/recipes/classes/frontend/src/app/shared/ui/select/UiSelectComponent.recipe.md

Notes
- Generator used: scripts/generate_class_recipes.py
  - Creates one stub per exported class with Purpose, Public API (methods/properties), Dependencies, Usage Notes, Change History.
  - Skips existing files; safe to re-run.
- Idempotency verified: subsequent run reported “Created: 0”.
- Coverage aligned to “export class …” declarations in frontend/src/app.

Residual risks / open questions
- Default-exported classes and unusual multi-line class declarations are not detected; none found in this tree.
- If you want bilingual (JP/EN) or to include private members, we can extend the script. Would you like me to add support for export default class and static members next?
