import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { HoverMessageView } from './hover-message.types';

@Component({
  selector: 'li[app-hover-message]',
  standalone: true,
  templateUrl: './hover-message.component.html',
  styleUrl: './hover-message.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'hover-message',
    role: 'status',
    '[attr.data-severity]': 'message?.severity ?? null',
  },
})
export class HoverMessageComponent {
  @Input({ required: true })
  public message!: HoverMessageView;
}
