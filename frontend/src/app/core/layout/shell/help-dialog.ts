import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
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

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

@Component({
  selector: 'app-help-dialog',
  standalone: true,
  templateUrl: './help-dialog.html',
  styleUrl: './help-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpDialogComponent implements AfterViewInit {
  @Output() public readonly dismiss = new EventEmitter<void>();

  @ViewChild('panel', { static: true }) private readonly panel?: ElementRef<HTMLDivElement>;

  public readonly useCases: readonly UseCaseItem[] = [
    {
      title: '朝会前にタスクを洗い出す',
      summary: '散らかったメモを整理し、チーム全体で同じ状況を共有するための流れです。',
      steps: [
        '分析画面にミーティングメモやチャットログを貼り付け、AI 提案を生成します。',
        '提案されたタイトル・担当者・ストーリーポイントを確認し、必要に応じて整えます。',
        '公開ボタンからカードをボードに追加し、朝会で共有できるよう列を調整します。',
      ],
    },
    {
      title: 'バグ報告の対応をすぐに進める',
      summary: '緊急度の高い不具合を拾い上げ、担当者と状況を明確にするためのステップです。',
      steps: [
        'ボードで新規カードを作成し、再現手順やスクリーンショットをコメントに残します。',
        '担当者・期限・優先度ラベルを設定し、通知が必要であればメンションで知らせます。',
        '進捗に合わせてカードをドラッグし、最新のステータスと次のアクションを常に共有します。',
      ],
    },
    {
      title: 'スプリントの振り返りに活用する',
      summary: '実績データをもとに改善ポイントを抽出し、次のアクションへつなげる使い方です。',
      steps: [
        '分析ダッシュボードで対象期間をスプリントに合わせて絞り込みます。',
        '完了率やラベル別の工数を確認し、停滞している領域や偏りを洗い出します。',
        '気づいた内容を日報・週報画面で共有し、タスクとして再度ボードへ反映します。',
      ],
    },
  ];

  public readonly guides: readonly GuideItem[] = [
    {
      title: 'ワークスペースボード',
      description:
        'ステータスや担当者ごとにカードを整理し、ドラッグ＆ドロップで進捗を更新できます。カードを選択すると詳細ドロワーが開き、コメントやサブタスクをすばやく編集できます。',
      image: 'help/board.svg',
      alt: 'カンバン形式でカードが並んだボード画面のイラスト',
    },
    {
      title: 'タスク起票',
      description:
        'メモや要望を貼り付けると、AI がタスク案やストーリーポイントの目安を提案します。内容を確認し、必要な分だけ編集してからボードに追加しましょう。',
      image: 'help/input.svg',
      alt: 'AI の提案プレビューが表示されたタスク起票画面のイラスト',
    },
    {
      title: '分析ダッシュボード',
      description:
        '完了率やステータスの分布、ラベル別の工数をグラフで確認できます。期間を絞り込んでチームの傾向を把握し、改善に活かしてください。',
      image: 'help/analytics.svg',
      alt: 'グラフと指標カードが並ぶ分析ダッシュボード画面のイラスト',
    },
    {
      title: 'ワークスペース設定',
      description:
        '独自のステータスやラベル、AI プロンプトを定義して運用に合わせられます。変更内容は即時にボードへ反映され、全員が同じ定義で作業できます。',
      image: 'help/settings.svg',
      alt: '設定項目のフォームが並ぶワークスペース設定画面のイラスト',
    },
  ];

  public readonly faqs: readonly FaqItem[] = [
    {
      question: 'AI の提案結果は編集できますか？',
      answer:
        'はい。タスク起票画面で提案されたタイトルや詳細、ストーリーポイントを直接修正し、納得した内容のみをボードに公開できます。',
    },
    {
      question: 'カードの履歴はどこで確認できますか？',
      answer:
        'ボード上のカードを開くと詳細ドロワーに移動履歴やコメントが時系列で表示され、変更内容を追跡できます。',
    },
    {
      question: 'ダークモードを固定することはできますか？',
      answer:
        'ヘッダーのテーマ切替ボタンからライト・ダーク・システム設定を切り替えられます。選択内容はブラウザに保存されるため、次回以降も同じモードで表示されます。',
    },
    {
      question: 'ワークスペース設定の変更はいつ反映されますか？',
      answer:
        '設定を保存すると即座に全ユーザーへ反映され、新しいステータスやラベルをすぐに利用できます。',
    },
  ];

  public ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.panel?.nativeElement.focus();
    });
  }

  @HostListener('document:keydown', ['$event'])
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
