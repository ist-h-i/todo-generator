**What I Changed**
- Moved the entire Competency Level management UI (list + create form) under the コンピテンシー tab.
- Removed the Competency Level section from the API・日次上限 tab to avoid duplication.
- Kept all bindings, services, forms, and i18n intact. No TS changes required.

**Files Modified**
- frontend/src/app/features/admin/feature/admin-page.component.html

**Focused Diffs**
- Added コンピテンシーレベル section under コンピテンシー
  - frontend/src/app/features/admin/feature/admin-page.component.html:205
  - Inserted this section after the コンピテンシーを登録 form, within `@if (activeTab() === 'competencies') { ... }`:
```html
<section class="page-section">
  <header class="page-section__header">
    <h2 class="page-section__title">コンピテンシーレベル</h2>
    <p class="page-section__subtitle">
      評価時に選択できるレベルと段階数を管理します。識別子は英数字とハイフン/アンダースコアが利用できます。
    </p>
  </header>

  @if (competencyLevels().length === 0) {
    <p class="page-empty">まだレベルが登録されていません。下のフォームから追加してください。</p>
  } @else {
    <ul class="page-list">
      @for (level of competencyLevels(); track level.id) {
        <li class="page-list__item">
          <div class="page-list__heading">
            <div>
              <strong class="page-list__title">{{ level.label }}</strong>
              <span class="page-badge page-badge--accent">{{ level.scale }}段階</span>
            </div>
          </div>
          <div class="page-list__meta">
            <span>識別子: {{ level.value }}</span>
            @if (level.description) { <span>{{ level.description }}</span> }
          </div>
        </li>
      }
    </ul>
  }

  <form class="page-form" [formGroup]="competencyLevelForm" (ngSubmit)="createCompetencyLevel()">
    <div class="form-grid form-grid--two">
      <label class="form-field">
        <span class="form-field__label">表示名</span>
        <input type="text" class="form-control" name="competency-level-label" formControlName="label" required />
      </label>
      <label class="form-field">
        <span class="form-field__label">識別子</span>
        <input type="text" class="form-control" name="competency-level-value" formControlName="value" placeholder="例: senior" required />
      </label>
      <label class="form-field">
        <span class="form-field__label">段階数</span>
        <app-ui-select name="competency-level-scale" formControlName="scale" [options]="competencyLevelScaleOptions"></app-ui-select>
      </label>
      <label class="form-field form-field--full">
        <span class="form-field__label">説明 (任意)</span>
        <textarea rows="2" class="form-control form-control--textarea" name="competency-level-description" formControlName="description" placeholder="用途や評価対象をメモできます"></textarea>
      </label>
      <label class="form-field">
        <span class="form-field__label">表示順 (任意)</span>
        <input type="number" class="form-control" name="competency-level-sort" formControlName="sort_order" placeholder="0" />
      </label>
    </div>
    <p class="form-note">識別子は英数字・ハイフン・アンダースコアのみ利用できます。</p>
    <button type="submit" class="button button--secondary" [disabled]="loading()">レベルを追加</button>
  </form>
</section>
```

- Removed コンピテンシーレベル section from API・日次上限
  - frontend/src/app/features/admin/feature/admin-page.component.html: previously inside `@if (activeTab() === 'settings') { ... }`, the entire コンピテンシーレベル `<section>` was deleted. The remaining sections in this tab are “Gemini API キー” and “デフォルト日次上限”.

**Why This Is Minimal**
- Only the template location changed; no business logic, services, or forms were altered.
- All existing component properties/methods (e.g., `competencyLevels()`, `competencyLevelForm`, `createCompetencyLevel()`, `competencyLevelScaleOptions`, `loading()`) remain valid and in scope.

**How to Verify**
- Navigate to Admin > コンピテンシー:
  - Confirm コンピテンシーレベル list and add form appear below コンピテンシーを登録.
  - Create a level, see it listed, refresh and confirm persistence.
- Navigate to Admin > API・日次上限:
  - Confirm コンピテンシーレベル section is no longer present.
  - Gemini API キー and デフォルト日次上限 remain functional.
- Sanity check: Creating a コンピテンシー still shows level choices as before.

**Residual Risks / Open Questions**
- Deep links/bookmarks to the old settings tab section (if any) will no longer land on コンピテンシーレベル.
- Minor layout or focus-order shifts under コンピテンシー due to new placement.
- If there are E2E tests or analytics targeting the old DOM location, selectors may need updating.

If you want, I can scan/update any E2E selectors or analytics events that referenced the old location.