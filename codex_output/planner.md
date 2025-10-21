Summary
- The component `app-ui-select` already supports content-projected <option> elements and reads them into its internal list for the custom panel.
- All current usages already pass <option> children, e.g.:
  - frontend/src/app/features/admin/page.html:129
  - frontend/src/app/features/admin/page.html:218
  - frontend/src/app/features/admin/page.html:231
  - frontend/src/app/features/admin/page.html:423
  - frontend/src/app/features/reports/reports-page.component.html:255
  - frontend/src/app/features/reports/reports-page.component.html:274
- The likely issue is synchronization between the form control’s value and the native select (impacting displayed label and perceived “no options”), not the absence of options themselves.

Plan
- Confirm API: Standardize on projected <option> usage (no [options] Input).
- Audit usages: Ensure each usage provides proper <option> children, including placeholder where needed.
- Minimal component hardening: Keep options sync robust and reflect value into the native select during writeValue to avoid empty selectedLabel on init and ensure internal/native alignment.
- Verify screens: Admin “レベル”, “ユーザ”, “モデル選択”; Reports “ステータス” and “優先度”.
- Quick checks: Template errors, reactive form binding, and visual dropdown options.

Proposed Changes (Minimal Impact)
- UiSelectComponent: In writeValue, also assign the value to the native select if available so the component’s label and native state are always in sync on init and when programmatically set. This is low-risk and ensures the custom panel shows the correct selection.
- Usages: Keep using <option> children. Add placeholder option where empty selection is valid (already present in most places). No refactor to an [options] API to minimize scope.

Why this route fits 30 minutes
- The codebase already aligns to the intended usage pattern; the component only needs a tiny sync improvement and a quick pass to confirm placeholders and bindings.
- Touches are localized: one component TS file and a quick verification of 6 usage sites.

Residual Risks / Open Questions
- Cross-browser behavior of the invisible native select with projected content (should be fine; but if a specific browser blocks options rendering in a hidden select, the panel might initially have zero options).
- If advanced option features are required (disabled, optgroup, custom template), current implementation supports disabled, not optgroups/custom templates.
- i18n of labels: Current strings are static; if translation keys are required, this is out of scope.

Acceptance Validation
- Options are visible in the custom dropdown panel for single-selects and in the native select for multi/size variants.
- Selecting an option updates the reactive form control and the trigger label.
- No console/template errors.

```json
{"steps":["coder","code_quality_reviewer"],"notes":"Standardize on projected <option> usage and minimally harden UiSelectComponent to reflect writeValue to the native select to ensure label/options sync. All usages already pass <option> children; only verify placeholders and bindings. Keep scope minimal and avoid introducing a new [options] API.","tests":"Manual checks: 1) Admin > コンピテンシー登録: the レベル dropdown shows 初級/中級 and selects correctly; label updates. 2) Admin > 手動判定: ユーザ and コンピテンシー dropdowns show dynamic lists; selecting updates form controls. 3) Admin > Gemini API キー: モデル select shows saved or known models; selecting updates form. 4) Reports > 提案編集: ステータス and 優先度 dropdowns show options; selection persists. 5) Verify no Angular template errors; no console errors; focusing away triggers onTouched without exceptions."}
```
