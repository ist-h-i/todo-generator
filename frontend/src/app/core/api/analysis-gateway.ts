import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, ResourceRef, Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { buildApiUrl } from '@core/api/api.config';
import { AI_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from '@core/api/timeout.interceptor';
import {
  AnalysisProposal,
  AnalysisRequest,
  AnalysisResult,
  Label,
  Status,
  WorkspaceSettings,
} from '@core/models';
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
  readonly warnings?: readonly string[];
  readonly proposals: readonly ApiAnalysisCard[];
}

type TokenSets = {
  readonly normalized: readonly string[];
  readonly compact: readonly string[];
};

const STATUS_CATEGORY_ALIASES: Record<string, Status['category']> = {
  todo: 'todo',
  'to do': 'todo',
  backlog: 'todo',
  'in progress': 'in-progress',
  'in-progress': 'in-progress',
  inprogress: 'in-progress',
  progress: 'in-progress',
  doing: 'in-progress',
  wip: 'in-progress',
  done: 'done',
  complete: 'done',
  completed: 'done',
};

function normalizeToken(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = `${value}`.replace(/\s+/g, ' ').trim().toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function compactNormalizedToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const compacted = value.replace(/[\s_-]+/g, '');
  return compacted.length > 0 ? compacted : null;
}

function extractCandidateTokens(value: string): TokenSets {
  const normalized: string[] = [];
  const compact: string[] = [];
  const seenNormalized = new Set<string>();
  const seenCompact = new Set<string>();

  const addCandidate = (candidate: string | null | undefined): void => {
    const normalizedValue = normalizeToken(candidate);
    if (!normalizedValue || seenNormalized.has(normalizedValue)) {
      return;
    }

    normalized.push(normalizedValue);
    seenNormalized.add(normalizedValue);

    const compactValue = compactNormalizedToken(normalizedValue);
    if (compactValue && !seenCompact.has(compactValue)) {
      compact.push(compactValue);
      seenCompact.add(compactValue);
    }
  };

  addCandidate(value);

  for (const match of value.matchAll(
    /\b(?:id|status|status_id|label|label_id)\s*[:=]\s*([A-Za-z0-9_-]+)/gi,
  )) {
    addCandidate(match[1]);
  }

  for (const part of value.split(/[\s,;、/|()[\]{}]+/)) {
    addCandidate(part);
  }

  return { normalized, compact };
}

export function resolveSuggestedStatusId(
  rawStatus: string | null | undefined,
  statuses: readonly Status[],
  defaultStatusId: string,
): string {
  if (!rawStatus) {
    return defaultStatusId;
  }

  const tokens = extractCandidateTokens(rawStatus);
  if (tokens.normalized.length === 0 && tokens.compact.length === 0) {
    return defaultStatusId;
  }

  const normalizeStatusId = (status: Status): string | null => normalizeToken(status.id);
  const normalizeStatusName = (status: Status): string | null => normalizeToken(status.name);
  const normalizeStatusCategory = (status: Status): string | null =>
    normalizeToken(status.category);
  const compactStatusName = (status: Status): string | null =>
    compactNormalizedToken(normalizeStatusName(status));
  const compactStatusCategory = (status: Status): string | null =>
    compactNormalizedToken(normalizeStatusCategory(status));

  for (const token of tokens.normalized) {
    const match = statuses.find(
      (status) => normalizeStatusId(status) === token || normalizeStatusName(status) === token,
    );
    if (match) {
      return match.id;
    }
  }

  for (const token of tokens.normalized) {
    const match = statuses.find((status) => normalizeStatusCategory(status) === token);
    if (match) {
      return match.id;
    }
  }

  for (const token of tokens.compact) {
    const match = statuses.find((status) => compactStatusName(status) === token);
    if (match) {
      return match.id;
    }
  }

  for (const token of tokens.compact) {
    const match = statuses.find((status) => compactStatusCategory(status) === token);
    if (match) {
      return match.id;
    }
  }

  for (const token of [...tokens.normalized, ...tokens.compact]) {
    const aliasCategory = STATUS_CATEGORY_ALIASES[token];
    if (!aliasCategory) {
      continue;
    }

    const match = statuses.find((status) => {
      const normalizedCategory = normalizeStatusCategory(status);
      if (normalizedCategory === aliasCategory) {
        return true;
      }

      const compactCategory = compactStatusCategory(status);
      if (compactCategory === aliasCategory) {
        return true;
      }

      const normalizedName = normalizeStatusName(status);
      if (normalizedName === aliasCategory) {
        return true;
      }

      const compactName = compactStatusName(status);
      return compactName === aliasCategory;
    });

    if (match) {
      return match.id;
    }
  }

  return defaultStatusId;
}

export function resolveSuggestedLabelIds(
  rawLabels: readonly string[] | undefined,
  labels: readonly Label[],
): readonly string[] {
  if (!rawLabels || rawLabels.length === 0) {
    return [];
  }

  const normalizedLookup = new Map<string, string>();
  const compactLookup = new Map<string, string>();

  for (const label of labels) {
    const normalizedId = normalizeToken(label.id);
    if (normalizedId && !normalizedLookup.has(normalizedId)) {
      normalizedLookup.set(normalizedId, label.id);
    }

    const normalizedName = normalizeToken(label.name);
    if (normalizedName && !normalizedLookup.has(normalizedName)) {
      normalizedLookup.set(normalizedName, label.id);
    }

    const compactId = compactNormalizedToken(normalizedId);
    if (compactId && !compactLookup.has(compactId)) {
      compactLookup.set(compactId, label.id);
    }

    const compactName = compactNormalizedToken(normalizedName);
    if (compactName && !compactLookup.has(compactName)) {
      compactLookup.set(compactName, label.id);
    }
  }

  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawLabels) {
    const tokens = extractCandidateTokens(raw);

    for (const token of tokens.normalized) {
      const match = normalizedLookup.get(token) ?? compactLookup.get(token);
      if (match && !seen.has(match)) {
        resolved.push(match);
        seen.add(match);
      }
    }

    for (const token of tokens.compact) {
      const match = compactLookup.get(token) ?? normalizedLookup.get(token);
      if (match && !seen.has(match)) {
        resolved.push(match);
        seen.add(match);
      }
    }
  }

  return resolved;
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

        const context = new HttpContext().set(REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS);
        return this.http.post<ApiAnalysisResponse>(buildApiUrl('/analysis'), payload, { context }).pipe(
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
      warnings: Array.isArray(response.warnings) ? response.warnings : [],
      proposals,
    } satisfies AnalysisResult;
  }

  private mapProposal(
    proposal: ApiAnalysisCard,
    settings: WorkspaceSettings,
    index: number,
  ): AnalysisProposal {
    const statusId = resolveSuggestedStatusId(
      proposal.status,
      settings.statuses,
      settings.defaultStatusId,
    );
    const labelIds = resolveSuggestedLabelIds(proposal.labels, settings.labels);
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
