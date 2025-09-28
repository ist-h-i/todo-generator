import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of, Subject } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { CardCreateRequest, CardResponse, CardsApiService } from '@core/api/cards-api.service';
import { CommentsApiService } from '@core/api/comments-api.service';
import { WorkspaceConfigApiService } from '@core/api/workspace-config-api.service';
import { Logger } from '@core/logger/logger';
import { AnalysisProposal, AuthenticatedUser } from '@core/models';

import { WorkspaceStore } from './workspace-store';

class MockAuthService {
  private readonly userStore = signal<AuthenticatedUser | null>(null);
  public readonly user = computed(() => this.userStore());

  public setUser(user: AuthenticatedUser | null): void {
    this.userStore.set(user);
  }
}

class MockCardsApiService {
  public readonly createCard = jasmine.createSpy('createCard');
  public readonly listCards = jasmine.createSpy('listCards').and.returnValue(of([]));
  public readonly updateCard = jasmine.createSpy('updateCard');
  public readonly deleteCard = jasmine.createSpy('deleteCard');
  public readonly createSubtask = jasmine.createSpy('createSubtask');
  public readonly updateSubtask = jasmine.createSpy('updateSubtask');
  public readonly deleteSubtask = jasmine.createSpy('deleteSubtask');
}

class MockCommentsApiService {
  public readonly createComment = jasmine.createSpy('createComment');
  public readonly updateComment = jasmine.createSpy('updateComment');
  public readonly deleteComment = jasmine.createSpy('deleteComment');
}

class MockWorkspaceConfigApiService {
  public readonly listStatuses = jasmine.createSpy('listStatuses').and.returnValue(of([]));
  public readonly listLabels = jasmine.createSpy('listLabels').and.returnValue(of([]));
  public readonly listTemplates = jasmine.createSpy('listTemplates').and.returnValue(of([]));
  public readonly createLabel = jasmine.createSpy('createLabel');
  public readonly deleteLabel = jasmine.createSpy('deleteLabel');
  public readonly createStatus = jasmine.createSpy('createStatus');
  public readonly deleteStatus = jasmine.createSpy('deleteStatus');
  public readonly createTemplate = jasmine.createSpy('createTemplate');
  public readonly updateTemplate = jasmine.createSpy('updateTemplate');
  public readonly deleteTemplate = jasmine.createSpy('deleteTemplate');
}

class MockLogger {
  public readonly error = jasmine.createSpy('error');
  public readonly warn = jasmine.createSpy('warn');
  public readonly info = jasmine.createSpy('info');
}

describe('WorkspaceStore.importProposals', () => {
  let store: WorkspaceStore;
  let cardsApi: MockCardsApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        WorkspaceStore,
        { provide: AuthService, useClass: MockAuthService },
        { provide: CardsApiService, useClass: MockCardsApiService },
        { provide: CommentsApiService, useClass: MockCommentsApiService },
        { provide: WorkspaceConfigApiService, useClass: MockWorkspaceConfigApiService },
        { provide: Logger, useClass: MockLogger },
      ],
    }).compileComponents();

    store = TestBed.inject(WorkspaceStore);
    cardsApi = TestBed.inject(CardsApiService) as unknown as MockCardsApiService;
  });

  it('persists eligible proposals before adding them to the board', async () => {
    const createCardCalls: CardCreateRequest[] = [];
    const responseSubject = new Subject<CardResponse>();

    cardsApi.createCard.and.callFake((payload: CardCreateRequest) => {
      createCardCalls.push(payload);
      return responseSubject.asObservable();
    });

    const proposals: AnalysisProposal[] = [
      {
        id: 'proposal-1',
        title: 'Improve signup form',
        summary: 'Simplify the error messages and add success feedback.',
        suggestedStatusId: 'status-todo',
        suggestedLabelIds: ['label-ux'],
        subtasks: ['Collect current errors', 'Draft success toast copy'],
        confidence: 0.82,
        templateId: null,
      },
    ];

    const importPromise = store.importProposals(proposals);

    expect(cardsApi.createCard).toHaveBeenCalledTimes(1);
    expect(createCardCalls[0]).toEqual(
      jasmine.objectContaining({
        title: 'Improve signup form',
        summary: 'Simplify the error messages and add success feedback.',
        status_id: 'status-todo',
        label_ids: ['label-ux'],
        ai_confidence: 0.82,
        assignees: [],
      }),
    );
    expect(createCardCalls[0]?.subtasks).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({ title: 'Collect current errors', status: 'todo' }),
        jasmine.objectContaining({ title: 'Draft success toast copy', status: 'todo' }),
      ]),
    );
    expect(store.cards()).toEqual([]);

    const response: CardResponse = {
      id: 'server-card-1',
      title: 'Improve signup form',
      summary: 'Simplify the error messages and add success feedback.',
      status_id: 'status-todo',
      label_ids: ['label-ux'],
      ai_confidence: 0.82,
      created_at: '2024-06-01T00:00:00.000Z',
      labels: [],
      subtasks: [],
      status: null,
    };

    responseSubject.next(response);

    await importPromise;

    const cards = store.cards();
    expect(cards.length).toBe(1);
    expect(cards[0]).toEqual(
      jasmine.objectContaining({
        id: 'server-card-1',
        originSuggestionId: 'proposal-1',
        statusId: 'status-todo',
        labelIds: ['label-ux'],
      }),
    );
  });

  it('propagates persistence errors without mutating the board state', async () => {
    const responseSubject = new Subject<CardResponse>();
    const error = new Error('network failure');

    cardsApi.createCard.and.returnValue(responseSubject.asObservable());

    const proposals: AnalysisProposal[] = [
      {
        id: 'proposal-1',
        title: 'Fix onboarding flow',
        summary: 'Resolve blockers reported by sales.',
        suggestedStatusId: 'status-todo',
        suggestedLabelIds: ['label-bug'],
        subtasks: [],
        confidence: 0.91,
        templateId: null,
      },
    ];

    const importPromise = store.importProposals(proposals);

    responseSubject.error(error);

    await expectAsync(importPromise).toBeRejectedWith(error);
    expect(store.cards()).toEqual([]);
  });
});
