import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Workspace shell providing navigation and global context for all feature pages.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  public readonly links = [
    { path: '/board', label: 'ボード' },
    { path: '/input', label: 'インプット解析' },
    { path: '/analytics', label: 'アナリティクス' },
    { path: '/settings', label: 'ワークスペース設定' },
  ] as const;

  public readonly year = new Date().getFullYear();
}
