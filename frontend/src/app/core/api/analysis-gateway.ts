import { Injectable, ResourceRef, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';

import { AnalysisRequest, AnalysisResult } from '@core/models';
import { Logger } from '@core/logger/logger';
import { WorkspaceStore } from '@core/state/workspace-store';
import { AnalysisProposalFactory } from './analysis-proposal-factory';

/**
 * Provides AI analysis proposals using Angular resources for lifecycle management.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisGateway {
  public constructor(
    private readonly logger: Logger,
    private readonly workspace: WorkspaceStore,
    private readonly proposalFactory: AnalysisProposalFactory,
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
              const settings = this.workspace.settings();
              const proposals = this.proposalFactory.buildProposals({
                request: params,
                settings,
              });

              subscriber.next({ proposals });
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

}
