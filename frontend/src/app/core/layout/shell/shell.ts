import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

type ThemePreference = 'light' | 'dark';

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
  private readonly document = inject(DOCUMENT);
  private readonly themeStorageKey = 'todo-generator:theme-preference';

  private readonly theme = signal<ThemePreference>(this.resolveInitialTheme());
  public readonly isDark = computed(() => this.theme() === 'dark');
  public readonly themeToggleAriaLabel = computed(() =>
    this.isDark() ? 'ライトモードに切り替え' : 'ダークモードに切り替え'
  );

  private readonly syncTheme = effect(() => {
    const mode = this.theme();
    const root = this.document?.documentElement;

    if (!root) {
      return;
    }

    root.classList.toggle('dark', mode === 'dark');
    root.setAttribute('data-theme', mode);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(this.themeStorageKey, mode);
      } catch {
        // Storage might be unavailable (private mode or SSR); ignore errors silently.
      }
    }
  });

  public readonly links = [
    { path: '/board', label: 'ボード' },
    { path: '/input', label: 'インプット解析' },
    { path: '/analytics', label: 'アナリティクス' },
    { path: '/settings', label: 'ワークスペース設定' },
  ] as const;

  public readonly year = new Date().getFullYear();
  public readonly user = this.auth.user;

  public toggleTheme(): void {
    this.theme.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }

  public readonly logout = (): void => {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  };

  private resolveInitialTheme(): ThemePreference {
    if (typeof window === 'undefined') {
      return 'light';
    }

    try {
      const stored = window.localStorage.getItem(this.themeStorageKey);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      // Ignore storage access issues and fallback to system preference.
    }

    if (typeof window.matchMedia === 'function') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch {
        return 'light';
      }
    }

    return 'light';
  }
}
