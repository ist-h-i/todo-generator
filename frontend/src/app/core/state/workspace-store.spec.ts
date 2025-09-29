import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { BoardLayoutsApiService, BoardLayoutResponse } from '@core/api/board-layouts-api.service';
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

class MockBoardLayoutsApiService {
  public readonly getBoardLayout = jasmine.createSpy('getBoardLayout');
  public readonly updateBoardLayout = jasmine.createSpy('updateBoardLayout');
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
}

const createAuthenticatedUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'user-1',
  email: 'user@example.com',
  is_admin: false,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  nickname: 'Tester',
  experience_years: null,
  roles: [],
  bio: null,
  avatar_url: null,
  ...overrides,
});

const createBoardLayoutResponse = (
  overrides: Partial<BoardLayoutResponse> = {},
): BoardLayoutResponse => ({
  user_id: 'user-1',
  board_grouping: 'status',
  board_layout: {
    filters: {
      search: '',
      labelIds: [],
      statusIds: [],
      quickFilters: [],
    },
  },
  visible_fields: [],
  notification_settings: {},
  preferred_language: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('WorkspaceStore', () => {
  let store: WorkspaceStore;
  let cardsApi: MockCardsApiService;
  let boardLayoutsApi: MockBoardLayoutsApiService;
  let auth: MockAuthService;
  let logger: MockLogger;
  let workspaceConfigApi: MockWorkspaceConfigApiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        WorkspaceStore,
        { provide: AuthService, useClass: MockAuthService },
        { provide: BoardLayoutsApiService, useClass: MockBoardLayoutsApiService },
        { provide: CardsApiService, useClass: MockCardsApiService },
        { provide: CommentsApiService, useClass: MockCommentsApiService },
        { provide: WorkspaceConfigApiService, useClass: MockWorkspaceConfigApiService },
        { provide: Logger, useClass: MockLogger },
      ],
    }).compileComponents();

    localStorage.clear();

    store = TestBed.inject(WorkspaceStore);
    cardsApi = TestBed.inject(CardsApiService) as unknown as MockCardsApiService;
    boardLayoutsApi = TestBed.inject(
      BoardLayoutsApiService,
    ) as unknown as MockBoardLayoutsApiService;
    workspaceConfigApi = TestBed.inject(
      WorkspaceConfigApiService,
    ) as unknown as MockWorkspaceConfigApiService;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    logger = TestBed.inject(Logger) as unknown as MockLogger;

    boardLayoutsApi.getBoardLayout.and.returnValue(of(createBoardLayoutResponse()));
    boardLayoutsApi.updateBoardLayout.and.returnValue(of(createBoardLayoutResponse()));
  });

  describe('importProposals', () => {
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
          ai_confidence: 82,
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
        ai_confidence: 82,
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

  describe('board preferences', () => {
    it('applies remote preferences when load succeeds', async () => {
      const response$ = new Subject<BoardLayoutResponse>();
      const user = createAuthenticatedUser({ id: 'user-42' });
      boardLayoutsApi.getBoardLayout.and.returnValue(response$.asObservable());

      auth.setUser(user);
      expect(boardLayoutsApi.getBoardLayout).toHaveBeenCalledTimes(1);

      response$.next(
        createBoardLayoutResponse({
          user_id: user.id,
          board_grouping: 'label',
          board_layout: {
            filters: {
              search: 'roadmap',
              labelIds: ['label-1'],
              statusIds: ['status-1'],
              quickFilters: ['myAssignments'],
            },
          } as Record<string, unknown>,
        }),
      );

      await Promise.resolve();
      await Promise.resolve();

      expect(store.grouping()).toBe('label');
      expect(store.filters()).toEqual(
        jasmine.objectContaining({
          search: 'roadmap',
          labelIds: ['label-1'],
          statusIds: ['status-1'],
          quickFilters: ['myAssignments'],
        }),
      );

      const key = `verbalize-yourself/workspace-preferences/${user.id}`;
      const cached = JSON.parse(localStorage.getItem(key) ?? '{}');
      expect(cached.grouping).toBe('label');
      expect(cached.filters.labelIds).toEqual(['label-1']);
      expect(cached.filters.statusIds).toEqual(['status-1']);
    });

    it('uses cached preferences when remote request fails', async () => {
      const user = createAuthenticatedUser({ id: 'user-77' });
      const storageKey = `verbalize-yourself/workspace-preferences/${user.id}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          grouping: 'label',
          filters: {
            search: 'retrospective',
            labelIds: ['label-3'],
            statusIds: [],
            quickFilters: [],
          },
        }),
      );

      boardLayoutsApi.getBoardLayout.and.returnValue(throwError(() => new Error('network')));

      auth.setUser(user);

      await Promise.resolve();
      await Promise.resolve();

      expect(store.grouping()).toBe('label');
      expect(store.filters().search).toBe('retrospective');
      expect(logger.error).toHaveBeenCalled();
    });

    it('retains cached preferences when the remote payload is empty', async () => {
      const user = createAuthenticatedUser({ id: 'user-55' });
      const storageKey = `verbalize-yourself/workspace-preferences/${user.id}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          grouping: 'assignee',
          filters: {
            search: 'product launch',
            labelIds: ['label-beta'],
            statusIds: ['status-review'],
            quickFilters: ['myAssignments'],
          },
        }),
      );

      boardLayoutsApi.getBoardLayout.and.returnValue(
        of(
          createBoardLayoutResponse({
            user_id: user.id,
            board_grouping: null,
            board_layout: null,
          }),
        ),
      );

      auth.setUser(user);

      await Promise.resolve();
      await Promise.resolve();

      expect(store.grouping()).toBe('assignee');
      expect(store.filters()).toEqual(
        jasmine.objectContaining({
          search: 'product launch',
          labelIds: ['label-beta'],
          statusIds: ['status-review'],
          quickFilters: ['myAssignments'],
        }),
      );
    });

    it('clears filters that reference removed statuses when settings refresh', async () => {
      const user = createAuthenticatedUser({ id: 'user-legacy' });
      const settingsKey = `verbalize-yourself/workspace-settings/${user.id}`;
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          defaultStatusId: 'status-obsolete',
          defaultAssignee: '',
          timezone: 'UTC',
          statuses: [
            {
              id: 'status-obsolete',
              name: 'Obsolete',
              category: 'todo',
              order: 0,
              color: '#64748b',
            },
          ],
          labels: [],
          templates: [],
          storyPointScale: [],
        }),
      );

      const preferencesKey = `verbalize-yourself/workspace-preferences/${user.id}`;
      localStorage.setItem(
        preferencesKey,
        JSON.stringify({
          grouping: 'status',
          filters: {
            search: '',
            labelIds: [],
            statusIds: ['status-obsolete'],
            quickFilters: [],
          },
        }),
      );

      workspaceConfigApi.listStatuses.and.returnValue(
        of([
          {
            id: 'status-active',
            name: 'Active',
            category: 'todo',
            order: 0,
            color: '#2563eb',
            wip_limit: null,
          },
        ]),
      );

      auth.setUser(user);

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(workspaceConfigApi.listStatuses).toHaveBeenCalled();
      expect(store.filters().statusIds).toEqual([]);

      const persisted = JSON.parse(localStorage.getItem(preferencesKey) ?? '{}');
      expect(persisted.filters?.statusIds).toEqual([]);
    });

    it('persists grouping updates via the board layout API', async () => {
      const user = createAuthenticatedUser({ id: 'user-88' });
      auth.setUser(user);

      await Promise.resolve();
      await Promise.resolve();

      boardLayoutsApi.updateBoardLayout.calls.reset();

      store.setGrouping('label');

      expect(boardLayoutsApi.updateBoardLayout).toHaveBeenCalledTimes(1);
      const payload = boardLayoutsApi.updateBoardLayout.calls.mostRecent().args[0];
      expect(payload.board_grouping).toBe('label');
      expect(payload.board_layout).toEqual(
        jasmine.objectContaining({
          filters: jasmine.objectContaining({
            quickFilters: [],
            labelIds: [],
            statusIds: [],
          }),
        }),
      );
    });

    it('persists filter updates via the board layout API', async () => {
      const user = createAuthenticatedUser({ id: 'user-99' });
      auth.setUser(user);

      await Promise.resolve();
      await Promise.resolve();

      boardLayoutsApi.updateBoardLayout.calls.reset();

      store.updateFilters({
        search: 'roadmap',
        labelIds: ['label-1', 'label-1'],
        statusIds: ['status-2'],
        quickFilters: ['myAssignments'],
      });

      expect(boardLayoutsApi.updateBoardLayout).toHaveBeenCalledTimes(1);
      const payload = boardLayoutsApi.updateBoardLayout.calls.mostRecent().args[0];
      expect(payload.board_layout).toEqual(
        jasmine.objectContaining({
          filters: jasmine.objectContaining({
            search: 'roadmap',
            quickFilters: ['myAssignments'],
          }),
        }),
      );
    });

    it('skips remote persistence when the user is anonymous', () => {
      boardLayoutsApi.updateBoardLayout.calls.reset();

      store.setGrouping('label');

      expect(boardLayoutsApi.updateBoardLayout).not.toHaveBeenCalled();
      const cached = JSON.parse(
        localStorage.getItem('verbalize-yourself/workspace-preferences/anonymous') ?? '{}',
      );
      expect(cached.grouping).toBe('label');
    });
  });
});
