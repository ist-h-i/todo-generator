import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { HelpDialogComponent } from './help-dialog';

type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Workspace shell providing navigation and global context for all feature pages.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HelpDialogComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeStorageKey = 'todo-generator:theme-preference';
  private readonly helpDialogVisible = signal(false);

  private readonly themeLabels: Record<ThemePreference, string> = {
    light: 'ライトモード',
    dark: 'ダークモード',
    system: 'システム設定',
  } as const;

  private readonly themeCycle: readonly ThemePreference[] = ['system', 'dark', 'light'] as const;

  private readonly systemTheme = signal<'dark' | 'light'>(this.detectSystemTheme());
  private readonly theme = signal<ThemePreference>(this.resolveInitialTheme());
  private readonly effectiveTheme = computed<'dark' | 'light'>(() => {
    const preference = this.theme();
    return preference === 'system' ? this.systemTheme() : preference;
  });

  public readonly themePreference = computed(() => this.theme());
  public readonly themeDisplayLabel = computed(() => this.themeLabels[this.themePreference()]);
  public readonly themeNextLabel = computed(
    () => this.themeLabels[this.nextTheme(this.themePreference())],
  );
  public readonly isDark = computed(() => this.effectiveTheme() === 'dark');
  public readonly themeToggleAriaLabel = computed(
    () =>
      `テーマ設定。現在は${this.themeDisplayLabel()}。クリックすると${this.themeNextLabel()}に切り替わります。`,
  );
  public readonly isHelpDialogOpen = computed(() => this.helpDialogVisible());

  private readonly syncTheme = effect(() => {
    const preference = this.theme();
    const mode = this.effectiveTheme();
    const root = this.document?.documentElement;

    if (!root) {
      return;
    }

    root.classList.toggle('dark', mode === 'dark');
    root.setAttribute('data-theme', mode);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(this.themeStorageKey, preference);
      } catch {
        // Storage might be unavailable (private mode or SSR); ignore errors silently.
      }
    }
  });

  public readonly isAdmin = this.auth.isAdmin;

  public readonly navigationLinks = computed(() => {
    const links = [
      { path: '/board', label: 'ボード' },
      { path: '/input', label: 'タスク起票' },
      { path: '/analytics', label: '分析' },
      { path: '/settings', label: 'ワークスペース設定' },
    ];

    if (this.isAdmin()) {
      links.push({ path: '/admin', label: '管理コンソール' });
    }

    return links;
  });

  public readonly year = new Date().getFullYear();
  public readonly user = this.auth.user;

  public toggleTheme(): void {
    this.theme.update((mode) => this.nextTheme(mode));
  }

  public openHelp(): void {
    this.helpDialogVisible.set(true);
  }

  public closeHelp(): void {
    this.helpDialogVisible.set(false);
  }

  public readonly logout = (): void => {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  };

  public readonly openSettings = (): void => {
    void this.router.navigateByUrl('/admin');
  };

  public constructor() {
    this.setupSystemThemeListener();
  }

  private resolveInitialTheme(): ThemePreference {
    if (typeof window === 'undefined') {
      return 'system';
    }

    try {
      const stored = window.localStorage.getItem(this.themeStorageKey);
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        return stored;
      }
    } catch {
      // Ignore storage access issues and fallback to system preference.
    }

    return 'system';
  }

  private detectSystemTheme(): 'dark' | 'light' {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'light';
    }

    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  private setupSystemThemeListener(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    let mediaQuery: MediaQueryList;
    try {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }

    const updateTheme = (matches: boolean): void => {
      this.systemTheme.set(matches ? 'dark' : 'light');
    };

    updateTheme(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent): void => {
      updateTheme(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', listener));
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(listener);
      this.destroyRef.onDestroy(() => mediaQuery.removeListener(listener));
    }
  }

  private nextTheme(mode: ThemePreference): ThemePreference {
    const index = this.themeCycle.indexOf(mode);

    if (index === -1) {
      return this.themeCycle[0];
    }

    return this.themeCycle[(index + 1) % this.themeCycle.length];
  }
}
