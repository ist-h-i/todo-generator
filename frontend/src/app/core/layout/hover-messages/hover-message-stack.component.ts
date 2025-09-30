import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type HoverMessageSeverity = 'info' | 'success' | 'warning' | 'danger';

export type HoverMessageView = {
  readonly id: number;
  readonly text: string;
  readonly severity: HoverMessageSeverity;
};

@Component({
  selector: 'app-hover-message-stack',
  standalone: true,
  templateUrl: './hover-message-stack.component.html',
  styleUrl: './hover-message-stack.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'hover-message-stack',
    role: 'region',
    'aria-live': 'polite',
    'aria-label': 'グローバル通知',
    '[class.hover-message-stack--visible]': 'messages.length > 0',
    '[attr.aria-hidden]': 'messages.length === 0 ? "true" : null',
  },
})
export class HoverMessageStackComponent {
  @Input({ required: true })
  public messages: readonly HoverMessageView[] = [];

  public trackById = (_: number, message: HoverMessageView): number => message.id;
}
