Summary of work
- Co-located all recipe docs next to their target source code.
- Updated docs index and workflow/prompt templates to remove centralized recipes references.
- Updated generator scripts to create recipes in the new co-located locations.
- Deprecated the old docs/recipes/ folder with a clear migration notice.
- Removed the centralized recipe files to avoid duplication.

What changed

- Recipes moved next to code
  - Added per-file recipes:
    - backend/app/main.py.recipe.md
    - backend/app/routers/status_reports.py.recipe.md
    - backend/app/services/status_reports.py.recipe.md
    - frontend/src/app/app.ts.recipe.md
    - frontend/src/app/core/api/status-reports-gateway.ts.recipe.md
  - Added Angular class recipes co-located with their TS sources, for example:
    - frontend/src/app/App.recipe.md
    - frontend/src/app/features/analyze/AnalyzePage.recipe.md
    - frontend/src/app/features/reports/ReportAssistantPageComponent.recipe.md
    - frontend/src/app/core/api/StatusReportsGateway.recipe.md
    - frontend/src/app/core/state/WorkspaceStore.recipe.md
    - frontend/src/app/shared/ui/page-layout/PageLayoutComponent.recipe.md
    - …and the rest under frontend/src/app/** (mirroring prior docs/recipes/classes/frontend/src/app/**)

- Centralized recipes removed
  - Deleted centralized files under:
    - docs/recipes/*.recipe.md (5 files)
    - docs/recipes/classes/frontend/src/app/** (all class recipe files)

- Docs updated
  - docs/README.md: Removed “Recipes index” link; added note that recipes are co-located as *.recipe.md next to code.
  - docs/INDEX.md: Updated scripts description to reflect co-located recipe output.
  - docs/recipes/README.md: Rewritten as deprecation notice with new co-location policy and updated generator instructions.

- Scripts updated
  - scripts/generate_file_recipes.py
    - Now writes to <source>.<ext>.recipe.md next to the source file.
    - Updated docstring and removed use of the centralized folder.
  - scripts/generate_class_recipes.py
    - Now writes ClassName.recipe.md next to the TS file directory.
    - Updated docstring and path function.

- Workflow and prompts updated (remove centralized references)
  - workflow/README.md
  - prompts/coder.prompt.md
  - prompts/planner.prompt.md
  - prompts/detail_designer.prompt.md (main reference updated)
  - prompts/integrator.prompt.md
  - prompts/release_manager.prompt.md
  - prompts/uiux_reviewer.prompt.md
  - prompts/doc_editor.prompt.md
  - prompts/requirements_analyst.prompt.md
  - prompts/i18n_reviewer.prompt.md
  - prompts/docwriter.prompt.md
  - prompts/oss_sbom_auditor.prompt.md
  - prompts/requirements_reviewer.prompt.md
  - prompts/threat_modeler.prompt.md
  - prompts/code_quality_reviewer.prompt.md
  - prompts/implementation_reviewer.prompt.md
  - prompts/performance_reviewer.prompt.md
  - prompts/ai_safety_reviewer.prompt.md

Validation commands
- Confirm no centralized references remain (except deprecation note and past automation logs):
  - rg -n "docs/recipes/" -S
- Spot-check a few recipes in their new locations:
  - open frontend/src/app/core/api/status-reports-gateway.ts.recipe.md
  - open backend/app/routers/status_reports.py.recipe.md
- Optionally generate new recipes and ensure they land co-located:
  - python scripts/generate_file_recipes.py frontend/src/app/core/api
  - python scripts/generate_class_recipes.py frontend/src/app/features

Residual risks / open questions
- Any external docs or integrations outside this repo that point to docs/recipes/* will break; they need manual updates.
- If any internal tooling or CI parsers assumed a centralized path, they may require minor adjustments (we updated in-repo prompts and workflow references).
- Directories with multiple recipes (file-level + class-level) are now possible; if a naming convention limit is desired (e.g., one recipe per dir), define and enforce it.
- Embedded assets within recipes were not present here; if future recipes add assets, co-locate them alongside the recipe to avoid path issues.
- The deprecated docs/recipes/ path has a migration README but is otherwise empty; if you prefer a hard removal, we can delete the folder entirely once external references are confirmed removed.

Next step
- Do you want me to run a full-text search to highlight any remaining external references you expect to update manually (e.g., wikis/PR templates)?