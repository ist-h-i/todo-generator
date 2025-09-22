import { Injectable, ResourceRef, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';

import { AnalysisProposal, AnalysisRequest, AnalysisResult } from '@core/models';
import { Logger } from '@core/logger/logger';
import { createId } from '@core/utils/create-id';

/**
 * Provides AI analysis proposals using Angular resources for lifecycle management.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisGateway {
  public constructor(private readonly logger: Logger) {}

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
      stream: ({ params, abortSignal }): Observable<AnalysisResult | null> => {
        if (!params) {
          return of(null);
        }

        return new Observable<AnalysisResult | null>((subscriber) => {
          if (abortSignal.aborted) {
            subscriber.complete();

            return undefined;
          }

          const timer = setTimeout(() => {
            try {
              const baseTitle = this.resolveBaseTitle(params);
              const subtasks = this.resolveSubtasks(params.autoObjective);
              const buildProposal = (index: number): AnalysisProposal => ({
                id: createId(),
                title: `${baseTitle} #${index + 1}`,
                summary: `${params.objective} を達成するためのステップを整理しました。`,
                suggestedStatusId: index === 0 ? 'todo' : 'in-progress',
                suggestedLabelIds: index === 0 ? ['ai'] : ['frontend'],
                subtasks,
                confidence: 0.62 + index * 0.12,
              });

              subscriber.next({
                proposals: [buildProposal(0), buildProposal(1)],
              });
              subscriber.complete();
            } catch (error) {
              this.logger.error('analysis-gateway', error);
              subscriber.error(error);
            }
          }, 420);

          const abortHandler = (): void => {
            clearTimeout(timer);
            subscriber.complete();
          };

          abortSignal.addEventListener('abort', abortHandler);

          return (): void => {
            clearTimeout(timer);
            abortSignal.removeEventListener('abort', abortHandler);
          };
        });
      },
    });

  /**
   * Derives a proposal title baseline from request notes.
   *
   * @param request - Active analysis request payload.
   * @returns Primary title text.
   */
  private readonly resolveBaseTitle = (request: AnalysisRequest): string =>
    request.notes.split('\n')[0]?.trim() || 'ChatGPT 提案';

  /**
   * Builds a consistent subtask list based on the objective strategy.
   *
   * @param autoObjective - Whether the objective was AI generated.
   * @returns Subtask description list.
   */
  private readonly resolveSubtasks = (autoObjective: boolean): readonly string[] => [
    autoObjective ? 'AIが提案したゴール案を確認' : '提供されたゴールを整理',
    '重要な関係者と論点を共有',
    'リスクと成功条件を定義',
  ];
}
