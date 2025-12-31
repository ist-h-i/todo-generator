import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HoverMessage } from './hover-message';
import { HoverMessageView } from '@features/shell/models/hover-message.types';

@Component({
  selector: 'app-hover-message-stack',
  imports: [HoverMessage],
  templateUrl: './hover-message-stack.html',
  styleUrl: './hover-message-stack.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'hover-message-stack',
    role: 'region',
    'aria-live': 'polite',
    'aria-label': 'グローバル通知',
    '[class.hover-message-stack--visible]': 'messages().length > 0',
    '[attr.aria-hidden]': 'messages().length === 0 ? "true" : null',
  },
})
export class HoverMessageStack {
  public readonly messages = input.required<readonly HoverMessageView[]>();
}
