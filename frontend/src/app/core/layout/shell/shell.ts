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
import { HttpErrorNotifierService } from '@core/api/http-error-notifier.service';
import { HttpLoadingStore } from '@core/api/http-loading.store';
import { ProfileDialogComponent } from '@core/profile/profile-dialog';
import { UserProfile } from '@core/profile/profile.models';
import { HelpDialogComponent } from './help-dialog';
import { HoverMessageStackComponent } from '../hover-messages/hover-message-stack.component';
import { HoverMessageSeverity, HoverMessageView } from '../hover-messages/hover-message.types';

function extractRoleLabel(role: string): string {
  const separator = ' / ';
  const lastSeparatorIndex = role.lastIndexOf(separator);

  if (lastSeparatorIndex === -1) {
    return role;
  }

  return role.slice(lastSeparatorIndex + separator.length).trim();
}

function formatRoleLabels(roles: readonly string[]): string[] {
  return roles.map((role) => extractRoleLabel(role)).filter((label) => label.length > 0);
}

type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Workspace shell providing navigation and global context for all feature pages.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    HelpDialogComponent,
    ProfileDialogComponent,
    HoverMessageStackComponent,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly errorNotifier = inject(HttpErrorNotifierService);
  private readonly loadingStore = inject(HttpLoadingStore);
  private readonly themeStorageKey = 'verbalize-yourself:theme-preference';
  private readonly legacyThemeStorageKey = 'todo-generator:theme-preference';
  private readonly helpDialogVisible = signal(false);
  private readonly profileDialogVisible = signal(false);
  private readonly hoverMessageStore = signal<readonly HoverMessageView[]>([]);
  private readonly hoverMessageTimers = new Map<number, number>();
  private hoverMessageSequence = 0;

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
  public readonly isProfileDialogOpen = computed(() => this.profileDialogVisible());
  public readonly hoverMessageList = computed(() => this.hoverMessageStore());
  private readonly errorMessage = this.errorNotifier.message;
  private readonly loadingState = this.loadingStore.isLoading;
  private readonly loadingMessageState = this.loadingStore.message;
  public readonly globalErrorMessage = computed(() => this.errorMessage());
  public readonly isGlobalLoading = computed(() => {
    if (this.errorMessage()) {
      return false;
    }

    return this.loadingState();
  });
  public readonly globalLoadingMessage = computed(() => {
    if (!this.isGlobalLoading()) {
      return null;
    }

    return this.loadingMessageState();
  });

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
        window.localStorage.removeItem(this.legacyThemeStorageKey);
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
      { path: '/reports', label: '日報・週報解析' },
      { path: '/analytics', label: '分析' },
      { path: '/profile/evaluations', label: 'コンピテンシー' },
      { path: '/settings', label: '設定' },
    ];

    if (this.isAdmin()) {
      links.push({ path: '/admin', label: '管理' });
    }

    return links;
  });

  public readonly year = new Date().getFullYear();
  public readonly user = this.auth.user;

  public formatRolePreview(roles: readonly string[]): string {
    const labels = formatRoleLabels(roles);

    if (labels.length === 0) {
      return '';
    }

    const preview = labels.slice(0, 2).join(' / ');
    return labels.length > 2 ? `${preview} / …` : preview;
  }

  public formatRoleTooltip(roles: readonly string[]): string {
    return formatRoleLabels(roles).join(' / ');
  }

  public openProfile(): void {
    this.profileDialogVisible.set(true);
  }

  public closeProfile(): void {
    this.profileDialogVisible.set(false);
  }

  public onProfileSaved(profile: UserProfile): void {
    this.auth.applyUserProfile(profile);
    this.closeProfile();
    this.showProfileToast('プロフィールを更新しました。');
  }

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

  public readonly dismissGlobalError = (): void => {
    this.errorNotifier.clear();
  };

  public constructor() {
    this.setupSystemThemeListener();
    this.destroyRef.onDestroy(() => {
      this.clearHoverMessageTimers();
    });
  }

  private resolveInitialTheme(): ThemePreference {
    if (typeof window === 'undefined') {
      return 'system';
    }

    try {
      const storage = window.localStorage;
      const stored = storage.getItem(this.themeStorageKey);
      if (this.isThemePreference(stored)) {
        return stored;
      }

      const legacy = this.migrateLegacyThemePreference(storage);
      if (legacy) {
        return legacy;
      }

      if (stored !== null) {
        try {
          storage.removeItem(this.themeStorageKey);
        } catch {
          // If removal fails, we still fallback to the system preference in-memory.
        }
      }

      this.persistThemePreference(storage, 'system');
    } catch {
      // Ignore storage access issues and fallback to system preference.
    }

    return 'system';
  }

  private persistThemePreference(storage: Storage, preference: ThemePreference): void {
    try {
      storage.setItem(this.themeStorageKey, preference);
    } catch {
      // Ignore storage persistence failures.
    }
  }

  private migrateLegacyThemePreference(storage: Storage): ThemePreference | null {
    const legacy = storage.getItem(this.legacyThemeStorageKey);
    if (this.isThemePreference(legacy)) {
      this.persistThemePreference(storage, legacy);

      try {
        storage.removeItem(this.legacyThemeStorageKey);
      } catch {
        // Removing the legacy key is best-effort only.
      }

      return legacy;
    }

    if (legacy !== null) {
      try {
        storage.removeItem(this.legacyThemeStorageKey);
      } catch {
        // Ignore removal issues for invalid legacy entries.
      }
    }

    return null;
  }

  private isThemePreference(value: unknown): value is ThemePreference {
    return value === 'dark' || value === 'light' || value === 'system';
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

  private showProfileToast(message: string): void {
    this.enqueueHoverMessage(message, 'success');
  }

  private enqueueHoverMessage(text: string, severity: HoverMessageSeverity = 'info'): void {
    const entry: HoverMessageView = {
      id: ++this.hoverMessageSequence,
      text,
      severity,
    };

    this.hoverMessageStore.update((messages) => [entry, ...messages]);

    if (typeof window === 'undefined') {
      return;
    }

    const timer = window.setTimeout(() => {
      this.hoverMessageTimers.delete(entry.id);
      this.hoverMessageStore.update((messages) =>
        messages.filter((message) => message.id !== entry.id),
      );
    }, 4000);

    this.hoverMessageTimers.set(entry.id, timer);
  }

  private clearHoverMessageTimers(): void {
    if (typeof window === 'undefined') {
      return;
    }

    for (const timer of this.hoverMessageTimers.values()) {
      window.clearTimeout(timer);
    }

    this.hoverMessageTimers.clear();
    this.hoverMessageStore.set([]);
  }
}
