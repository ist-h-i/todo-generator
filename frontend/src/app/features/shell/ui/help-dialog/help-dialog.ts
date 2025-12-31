import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  output,
} from '@angular/core';

interface GuideItem {
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly alt: string;
}

interface UseCaseItem {
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly string[];
}

interface AiFeatureItem {
  readonly title: string;
  readonly summary: string;
  readonly bullets: readonly string[];
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

@Component({
  selector: 'app-help-dialog',
  templateUrl: './help-dialog.html',
  styleUrl: './help-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class HelpDialog implements AfterViewInit {
  public readonly dismiss = output<void>();

  @ViewChild('panel', { static: true }) private readonly panel?: ElementRef<HTMLDivElement>;

  public readonly aiFeatures: readonly AiFeatureItem[] = [
    {
      title: 'タスク起票（メモ → カード案）',
      summary: 'ノートを貼り付けると、AI がカード案とサブタスクを提案します。',
      bullets: [
        '入力: ノート / ゴール（自動 or 手動）',
        'AI: タイトル・詳細・ラベル・サブタスクの提案 + おすすめ度',
        '出力: 編集した提案をボードへ追加',
        '関連: 設定 > テンプレート（おすすめ度しきい値 / 表示項目）',
      ],
    },
    {
      title: '日報・週報解析（振り返り → タスク候補）',
      summary: 'タグと本文をセクションで送ると、タスク候補と振り返り観点を抽出します。',
      bullets: [
        '入力: タグ / セクション（見出し + 本文）',
        'AI: タスク候補・サブタスク・振り返り観点の提案',
        '出力: 提案を編集して必要なものだけカード化',
        '関連: 分析 > 免疫マップ（レポートがコンテキストとして活用されます）',
      ],
    },
    {
      title: '免疫マップ生成（詰まりの構造化）',
      summary: '日報・カード履歴などのコンテキストから、免疫マップと読み解きを生成します。',
      bullets: [
        '入力: 起点候補（自動）/ Should-Cannot-Want（手動） + 任意の補足',
        'AI: Mermaid 図 + サマリー + 読み解きカード（根拠つき）',
        '出力: Mermaid を共有し、気づきをボードや日報へ反映',
        '関連: 日報・週報解析 / ボード / プロフィール（コンテキストとして参照）',
      ],
    },
  ];

  public readonly useCases: readonly UseCaseItem[] = [
    {
      title: 'メモからカードをまとめて起票する',
      summary: '雑多なメモを、実行できるタスクに分解してボードへ流し込みます。',
      steps: [
        '「タスク起票」でノートを貼り付け、ゴール（自動 / 手動）を決めます。',
        'AI が作成した提案を確認し、タイトル・詳細・ラベル・サブタスクを整えます。',
        '必要な提案だけ「カードに追加」して、ボードで優先度や進捗を管理します。',
      ],
    },
    {
      title: '日報・週報から改善タスクを拾う',
      summary: '日々の振り返りを、改善タスクと次のアクションに変換します。',
      steps: [
        '「日報・週報解析」でタグとセクション（見出し + 本文）を入力して解析します。',
        '提案されたカード候補や振り返り観点を確認し、必要なら編集・追加・削除します。',
        '必要な提案をカード化してボードへ送り、次のスプリント計画に反映します。',
      ],
    },
    {
      title: '免疫マップで詰まりを見える化する',
      summary: '起点を選んで、状況・制約・欲求の関係を図にして整理します。',
      steps: [
        '「分析」で候補カードを生成し、起点にしたい内容を選びます（手動入力も可能）。',
        '免疫マップを生成して、サマリー・読み解きカード・Mermaid 図を確認します。',
        'Mermaid を共有し、必要ならボードに改善タスクを追加します。',
      ],
    },
    {
      title: 'コンピテンシーを定期チェックする',
      summary: '実績を振り返り、次の行動プランに落とし込みます。',
      steps: [
        '「コンピテンシー」で評価対象を選び、上限回数を確認して評価を実行します。',
        'スコア・理由・推奨アクションを確認し、次に取り組むことを決めます。',
        '必要に応じて JSON で出力し、1on1 やスプリント計画に活用します。',
      ],
    },
  ];

  public readonly guides: readonly GuideItem[] = [
    {
      title: 'ワークスペースボード',
      description:
        'ステータスやラベルでカードを整理し、ドラッグ＆ドロップで進捗を更新できます。カード詳細ではサブタスク・コメント・履歴を確認しながら、作業の次の一手を決められます。',
      image: 'help/board.svg',
      alt: 'カンバン形式でカードが並んだボード画面のイラスト',
    },
    {
      title: 'タスク起票',
      description:
        'ノートから AI がカード案とサブタスクを生成します。おすすめ度を目安に提案を取捨選択し、編集してからボードに追加できます。',
      image: 'help/input.svg',
      alt: 'AI の提案プレビューが表示されたタスク起票画面のイラスト',
    },
    {
      title: '日報・週報解析',
      description:
        '日報・週報をセクション単位で入力し、AI がカード候補と振り返り観点を抽出します。解析履歴は免疫マップ生成のコンテキストとしても利用されます。',
      image: 'help/reports.svg',
      alt: '日報・週報のセクションと提案結果が並ぶ解析画面のイラスト',
    },
    {
      title: '分析ダッシュボード',
      description:
        '完了率やステータス・ラベルの分布をまとめて確認できます。免疫マップ生成では、候補カードを選んで Mermaid 図と読み解きを作成できます。',
      image: 'help/analytics.svg',
      alt: 'グラフと指標カードが並ぶ分析ダッシュボード画面のイラスト',
    },
    {
      title: 'コンピテンシー',
      description:
        'コンピテンシー評価の履歴を確認し、姿勢・行動の推奨アクションを振り返れます。評価には日次上限があるため、残り回数も合わせて確認してください。',
      image: 'help/competency.svg',
      alt: 'スコアと推奨アクションが表示されたコンピテンシー評価画面のイラスト',
    },
    {
      title: 'ワークスペース設定',
      description:
        'ステータス・ラベル・テンプレートを管理して運用に合わせられます。テンプレートは AI 提案の表示しきい値（おすすめ度）や、初期値・表示項目にも影響します。',
      image: 'help/settings.svg',
      alt: '設定項目のフォームが並ぶワークスペース設定画面のイラスト',
    },
  ];

  public readonly faqs: readonly FaqItem[] = [
    {
      question: 'AI の提案結果は編集できますか？',
      answer:
        'はい。タスク起票・日報週報解析で提案されたタイトルや詳細、ラベル、サブタスクを直接修正し、納得した内容のみをカードとしてボードに追加できます。',
    },
    {
      question: '提案が表示されない / 少ないのですが？',
      answer:
        'おすすめ度がテンプレートのしきい値を下回る提案は非表示になります。「設定 > テンプレート」でしきい値を調整するか、ノート・日報本文を具体的にして再度お試しください。',
    },
    {
      question: '日報・週報はどこで確認できますか？',
      answer:
        '「日報・週報解析」に履歴が残り、イベントや提案内容も確認できます。入力内容は免疫マップ生成のコンテキストとして利用されるため、機密情報は入力しないようご注意ください。',
    },
    {
      question: 'AI 機能が利用できない場合は？',
      answer:
        '管理者が Gemini API キーと利用モデルを設定しているか確認してください。日次上限に達している場合もあるため、時間をおいて再度お試しください。',
    },
    {
      question: 'ダークモードを固定することはできますか？',
      answer:
        'ヘッダーのテーマ切替ボタンからライト・ダーク・システム設定を切り替えられます。選択内容はブラウザに保存されるため、次回以降も同じモードで表示されます。',
    },
  ];

  public ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.panel?.nativeElement.focus();
    });
  }

  public onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    this.close();
  }

  public close(): void {
    this.dismiss.emit();
  }
}
