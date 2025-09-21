import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Shell } from '@core/layout/shell/shell';

/**
 * Root component wrapping the workspace shell.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Shell],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
