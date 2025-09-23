import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';

interface GuideItem {
  readonly title: string;
  readonly description: string;
  readonly image: string;
  readonly alt: string;
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

  public readonly guides: readonly GuideItem[] = [
    {
      title: 'ワークスペースボード',
      description:
        'ステータスや担当者ごとにカードを整理し、ドラッグ＆ドロップで進捗を更新できます。カードを選択すると詳細ドロワーが開き、コメントやサブタスクをすばやく編集できます。',
      image: 'help/board.svg',
      alt: 'カンバン形式でカードが並んだボード画面のイラスト',
    },
    {
      title: 'インプット解析',
      description:
        'メモや要望を貼り付けると、AI がタスク候補やストーリーポイントを提案します。内容をレビューし、必要に応じて編集してからボードに公開しましょう。',
      image: 'help/input.svg',
      alt: 'テキスト解析とAI提案のプレビューを表示する画面のイラスト',
    },
    {
      title: 'アナリティクス',
      description:
        '完了率やステータス分布、ラベル別の工数をグラフで確認できます。期間を絞り込んでチームの傾向を把握し、改善に活かしてください。',
      image: 'help/analytics.svg',
      alt: 'グラフと指標カードが並ぶアナリティクス画面のイラスト',
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
      answer: 'はい。インプット解析画面で提案されたタイトルや詳細、ストーリーポイントを直接修正し、納得した内容のみをボードに公開できます。',
    },
    {
      question: 'カードの履歴はどこで確認できますか？',
      answer: 'ボード上のカードを開くと詳細ドロワーに移動履歴やコメントが時系列で表示され、変更内容を追跡できます。',
    },
    {
      question: 'ダークモードを固定することはできますか？',
      answer: 'ヘッダーのテーマ切替ボタンからライト・ダーク・システム設定を切り替えられます。選択内容はブラウザに保存されるため、次回以降も同じモードで表示されます。',
    },
    {
      question: 'ワークスペース設定の変更はいつ反映されますか？',
      answer: '設定を保存すると即座に全ユーザーへ反映され、新しいステータスやラベルをすぐに利用できます。',
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
