import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { HoverMessages } from '@features/shell/data/hover-messages';
import { HoverMessageView } from '@features/shell/models/hover-message.types';

@Component({
  selector: 'li[app-hover-message]',
  templateUrl: './hover-message.html',
  styleUrl: './hover-message.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'hover-message',
    '[attr.role]': 'message()?.severity === "error" ? "alert" : "status"',
    '[attr.aria-live]': 'message()?.severity === "error" ? "assertive" : "polite"',
    '[attr.data-severity]': 'message()?.severity ?? null',
    '[attr.data-dismissing]': 'message()?.dismissing ? "true" : null',
  },
})
export class HoverMessage {
  private readonly hoverMessages = inject(HoverMessages);

  public readonly message = input.required<HoverMessageView>();

  public dismiss(event?: Event): void {
    event?.stopPropagation();
    this.hoverMessages.dismiss(this.message().id);
  }
}
