**背景**
- 症状: コンピテンシー登録フォームの「レベル」選択で候補が表示されない。
- 想定原因: 共有セレクト（`app-ui-select`）が投影`<option>`を`ngAfterViewInit`で一度だけ取得し、その後の動的挿入/更新に追従せず内部`options`が空のままになるタイミング不整合。
- 影響範囲: 「レベル」に限らず、同コンポーネント利用箇所でも同様事象が起こりうる。

**変更概要**
- 変更は共有UIコンポーネント内に限定（既存API/テンプレート不変更）。
- `OnDestroy`の導入とライフサイクル整備
  - `frontend/src/app/shared/ui/select/ui-select.ts:11` で `OnDestroy` をimport。
  - `frontend/src/app/shared/ui/select/ui-select.ts:182` でクラスに `OnDestroy` を実装。
- 初期読み取りの安定化
  - レンダリング完了後に遅延実行（`queueMicrotask`→フォールバック`setTimeout(0)`）で投影`<option>`を確実取得（`frontend/src/app/shared/ui/select/ui-select.ts:205` 付近）。
- 動的変化への追従
  - `MutationObserver` をネイティブ`<select>`に設定し、`childList/subtree/characterData/attributes`の変化で`readOptions()`→`syncLabelFromValue()`→`ensureActiveIndex()`を再評価。
  - 破棄時に`disconnect()`でクリーンアップ（`frontend/src/app/shared/ui/select/ui-select.ts:233` 付近）。
- 参照（レベル欄の利用箇所）: `frontend/src/app/features/admin/page.html:129`

**影響**
- 正常化: 「レベル」の選択肢が安定表示され、選択/送信に反映。
- 横展開: 他の`app-ui-select`利用箇所でも投影`<option>`の遅延挿入/更新に追従して安定化。
- 非互換なし: 公開APIやテンプレート構造、フォーム値は不変更。パフォーマンス影響は軽微。

**検証**
- 手動確認
  - 管理 → コンピテンシー登録 → 「レベル」ドロップダウンに期待項目（例: 「初級(3段階)」「中級(5段階)」）が表示される。
  - 候補を選択して送信し、リクエストペイロードに選択した`level`が含まれる。
  - コンソールエラーなし。
- スポットチェック
  - レポート等、他の`app-ui-select`利用画面で選択肢が表示・選択可能。
- 任意コマンド
  - `cd frontend && npm run lint`
  - `cd frontend && npm test`（あれば）

**レビュー観点**
- ライフサイクル: 初期遅延読み取りのタイミングが安定しているか、`ngOnDestroy`でObserver解放が漏れないか。
- 挙動維持: キーボード操作/フォーカス/ARIA属性など既存アクセシビリティの維持。
- 回帰: 他画面で意図しない選択更新や過剰な再計算が発生していないか。
- パフォーマンス: 大量オプションや頻繁な属性変更時のObserver負荷が実用上問題ないか。

**Residual Risks / Open Questions**
- もし本来API供給の選択肢でレスポンスが空の場合、UI修正では埋まらない（別途バックエンド対応が必要）。
- ラベルがi18n依存の場合、翻訳キー欠落で表示が空になる可能性。
- SSR/ハイドレーション環境がある場合、ブラウザ限定のObserver動作を確認要。
