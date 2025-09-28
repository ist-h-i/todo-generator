import { HttpClient } from '@angular/common/http';
import { Injectable, ResourceRef, Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { buildApiUrl } from '@core/api/api.config';
import { AnalysisProposal, AnalysisRequest, AnalysisResult, WorkspaceSettings } from '@core/models';
import { Logger } from '@core/logger/logger';
import { WorkspaceStore } from '@core/state/workspace-store';
import { createId } from '@core/utils/create-id';

interface ApiAnalysisSubtask {
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: string | null;
}

interface ApiAnalysisCard {
  readonly title: string;
  readonly summary: string;
  readonly status?: string | null;
  readonly labels?: readonly string[];
  readonly priority?: string | null;
  readonly due_in_days?: number | null;
  readonly subtasks?: readonly ApiAnalysisSubtask[];
}

interface ApiAnalysisRequest {
  readonly text: string;
  readonly max_cards: number;
  readonly notes?: string;
  readonly objective?: string;
  readonly auto_objective?: boolean;
}

interface ApiAnalysisResponse {
  readonly model: string;
  readonly proposals: readonly ApiAnalysisCard[];
}

/**
 * Provides AI analysis proposals backed by the FastAPI /analysis endpoint.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisGateway {
  private readonly http = inject(HttpClient);

  public constructor(
    private readonly logger: Logger,
    private readonly workspace: WorkspaceStore,
  ) {}

  /**
   * Creates a resource bound to the given request signal.
   *
   * @param request - Signal emitting analyze form payloads.
   * @returns Resource producing proposal responses.
   */
  public readonly createAnalysisResource = (
    request: Signal<AnalysisRequest | null>,
  ): ResourceRef<AnalysisResult | null> =>
    rxResource<AnalysisResult | null, AnalysisRequest | null>({
      defaultValue: null,
      params: request,
      stream: ({ params }): Observable<AnalysisResult | null> => {
        if (!params) {
          return of(null);
        }

        const settings = this.workspace.settings();
        const payload = this.buildPayload(params, settings);

        return this.http.post<ApiAnalysisResponse>(buildApiUrl('/analysis'), payload).pipe(
          map((response) => this.mapResponse(response, settings)),
          catchError((error) => {
            this.logger.error('analysis-gateway', error);
            return throwError(() => error);
          }),
        );
      },
    });

  private buildPayload(request: AnalysisRequest, settings: WorkspaceSettings): ApiAnalysisRequest {
    const notes = request.notes.trim();
    const objective = request.objective.trim();
    const text = this.composeRequestText(objective, notes);

    return {
      text,
      max_cards: this.resolveMaxCards(settings),
      notes,
      objective,
      auto_objective: request.autoObjective,
    } satisfies ApiAnalysisRequest;
  }

  private composeRequestText(objective: string, notes: string): string {
    const sections: string[] = [];

    if (objective.length > 0) {
      sections.push(`Objective: ${objective}`);
    }

    sections.push('Notes:');
    sections.push(notes);

    return sections.join('\n\n').trim();
  }

  private resolveMaxCards(settings: WorkspaceSettings): number {
    const templateCount = settings.templates.length;
    const baseline = templateCount > 0 ? templateCount : 3;
    const capped = Math.min(5, baseline);
    return Math.max(2, capped);
  }

  private mapResponse(response: ApiAnalysisResponse, settings: WorkspaceSettings): AnalysisResult {
    const proposals = (response.proposals ?? []).map((proposal, index) =>
      this.mapProposal(proposal, settings, index),
    );

    return {
      model: response.model ?? null,
      proposals,
    } satisfies AnalysisResult;
  }

  private mapProposal(
    proposal: ApiAnalysisCard,
    settings: WorkspaceSettings,
    index: number,
  ): AnalysisProposal {
    const statusId = this.resolveStatusId(proposal.status, settings);
    const labelIds = this.resolveLabelIds(proposal.labels, settings);
    const subtasks = (proposal.subtasks ?? [])
      .map((subtask) => this.formatSubtask(subtask))
      .filter((task): task is string => task.length > 0);

    return {
      id: createId(),
      title: proposal.title,
      summary: proposal.summary,
      suggestedStatusId: statusId,
      suggestedLabelIds: labelIds,
      subtasks,
      confidence: this.resolveConfidence(proposal.priority, index),
      templateId: null,
    } satisfies AnalysisProposal;
  }

  private resolveStatusId(status: string | null | undefined, settings: WorkspaceSettings): string {
    if (!status) {
      return settings.defaultStatusId;
    }

    const normalized = status.trim().toLowerCase();
    if (!normalized) {
      return settings.defaultStatusId;
    }

    const byId = settings.statuses.find((item) => item.id.toLowerCase() === normalized);
    if (byId) {
      return byId.id;
    }

    const byName = settings.statuses.find((item) => item.name.trim().toLowerCase() === normalized);
    if (byName) {
      return byName.id;
    }

    const byCategory = settings.statuses.find((item) => item.category === normalized);
    return byCategory?.id ?? settings.defaultStatusId;
  }

  private resolveLabelIds(
    labels: readonly string[] | undefined,
    settings: WorkspaceSettings,
  ): readonly string[] {
    if (!labels || labels.length === 0) {
      return [];
    }

    const lookup = new Map<string, string>();
    for (const label of settings.labels) {
      lookup.set(label.id.toLowerCase(), label.id);
      lookup.set(label.name.trim().toLowerCase(), label.id);
    }

    const resolved = labels
      .map((label) => lookup.get(label.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id));

    return Array.from(new Set(resolved));
  }

  private formatSubtask(subtask: ApiAnalysisSubtask): string {
    const title = subtask.title?.trim() ?? '';
    const description = subtask.description?.trim();

    if (title && description) {
      return `${title} — ${description}`;
    }

    return title || description || '';
  }

  private resolveConfidence(priority: string | null | undefined, index: number): number {
    if (priority) {
      const normalized = priority.trim().toLowerCase();
      if (normalized === 'urgent') {
        return 92;
      }

      if (normalized === 'high') {
        return 85;
      }

      if (normalized === 'medium') {
        return 75;
      }

      if (normalized === 'low') {
        return 65;
      }
    }

    const fallback = 78 - index * 4;
    return Math.max(60, Math.min(88, fallback));
  }
}
