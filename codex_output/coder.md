Here’s the minimal, targeted fix to ensure options render and stay in sync for all app-ui-select usages.

What I Changed
- Synced programmatic value into the native select in writeValue so the component’s internal label/options mapping initializes correctly and reliably reflects the selected state, even before user interaction.

Files Updated
- frontend/src/app/shared/ui/select/ui-select.ts:240
  - Replacement block (focused change):

    writeValue(obj: any): void {
      this.value = obj as string | string[] | null;
      // Reflect programmatic value into the native <select> so that
      // initial state stays in sync and labels resolve correctly even
      // before the first user interaction.
      const sel = this.nativeSelectRef?.nativeElement;
      if (sel) {
        if (this.multiple) {
          const selected = Array.isArray(this.value) ? this.value.map(String) : [];
          Array.from(sel.options).forEach((o) => (o.selected = selected.includes(o.value)));
        } else {
          sel.value = this.value != null ? String(this.value) : '';
        }
      }
      this.syncLabelFromValue();
    }

Why
- All current usages already project <option> children into app-ui-select, e.g.:
  - frontend/src/app/features/admin/page.html:129, :218, :231, :423
  - frontend/src/app/features/reports/reports-page.component.html:255, :274
- The component builds its option list from the native select. Without reflecting initial form control values into the native select, the label/options sync could appear empty or stale, leading to “no options” being perceived in the UI. The patch keeps the native select state aligned on initialization and when programmatic updates occur.

No Call-Site Changes Needed
- The existing usage pattern with projected <option> is correct for this component. No templates were modified.

How to Validate
- Click each app-ui-select and verify the dropdown panel contains expected options:
  - Admin > コンピテンシー登録: レベル shows 初級/中級 and selects properly.
  - Admin > 手動判定: 対象ユーザ/コンピテンシー show dynamic lists and selection updates form values.
  - Admin > Gemini API キー: 利用モデル list shows saved/known models; selection persists.
  - Reports > 提案編集: ステータス and 優先度 show correct options; selection persists.
- Confirm no console/template errors appear.

Residual Risks / Open Questions
- If any view relies on advanced option features (optgroup/custom templates), current implementation doesn’t support them; scope here is single-select with disabled/multiple/basic options.
- Cross‑browser inert support is generally good, but if a legacy browser behaves oddly, removing inert from the hidden native select could be a fallback.
