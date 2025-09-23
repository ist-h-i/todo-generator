import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterOutlet } from '@angular/router';

/**
 * Root component wrapping the workspace shell.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
