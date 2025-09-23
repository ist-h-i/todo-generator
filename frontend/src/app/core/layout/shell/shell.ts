import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  public readonly links = [
    { path: '/board', label: 'ボード' },
    { path: '/input', label: 'インプット解析' },
    { path: '/analytics', label: 'アナリティクス' },
    { path: '/settings', label: 'ワークスペース設定' },
  ] as const;

  public readonly year = new Date().getFullYear();
  public readonly user = this.auth.user;

  public readonly logout = (): void => {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  };
}
