import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { WorkspaceStore } from '@core/state/workspace-store';

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
  private readonly workspace = inject(WorkspaceStore);

  public readonly summarySignal = this.workspace.summary;
  public readonly groupingSignal = this.workspace.grouping;

  public readonly links = [
    { path: '/board', label: 'ボード' },
    { path: '/input', label: 'インプット解析' },
    { path: '/analytics', label: 'アナリティクス' },
    { path: '/settings', label: 'ワークスペース設定' },
  ] as const;

  public readonly progressLabel = computed(() => {
    const summary = this.summarySignal();
    return `${summary.progressRatio}% 完了`;
  });

  public readonly year = new Date().getFullYear();
}
