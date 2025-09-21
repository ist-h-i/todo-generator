import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WorkspaceStore } from '@core/state/workspace-store';
import { createSignalForm } from '@lib/forms/signal-forms';

/**
 * Settings page exposing workspace configuration controls.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private readonly workspace = inject(WorkspaceStore);

  public readonly settingsSignal = this.workspace.settings;

  public readonly labelForm = createSignalForm({ name: '', color: '#38bdf8' });
  public readonly statusForm = createSignalForm({
    name: '',
    category: 'todo' as 'todo' | 'in-progress' | 'done',
    color: '#64748b',
  });

  /**
   * Handles label form submission.
   *
   * @param event - Browser submit event.
   */
  public readonly saveLabel = (event: SubmitEvent): void => {
    event.preventDefault();
    const value = this.labelForm.value();
    if (value.name.trim().length === 0) {
      return;
    }
    this.workspace.addLabel({ name: value.name.trim(), color: value.color });
    this.labelForm.reset({ name: '', color: '#38bdf8' });
  };

  /**
   * Handles status form submission.
   *
   * @param event - Browser submit event.
   */
  public readonly saveStatus = (event: SubmitEvent): void => {
    event.preventDefault();
    const value = this.statusForm.value();
    if (value.name.trim().length === 0) {
      return;
    }
    this.workspace.addStatus({
      name: value.name.trim(),
      category: value.category,
      color: value.color,
    });
    this.statusForm.reset({ name: '', category: 'todo', color: '#64748b' });
  };
}
