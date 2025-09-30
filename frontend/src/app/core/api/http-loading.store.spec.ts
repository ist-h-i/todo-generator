import { TestBed } from '@angular/core/testing';

import { HttpLoadingStore } from './http-loading.store';

describe('HttpLoadingStore', () => {
  let store: HttpLoadingStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(HttpLoadingStore);
  });

  it('initializes with no active requests', () => {
    expect(store.activeRequestCount()).toBe(0);
    expect(store.isLoading()).toBeFalse();
    expect(store.message()).toBeNull();
  });

  it('tracks active requests and exposes the latest message', () => {
    store.beginRequest('req-1', '読み込み中...');
    expect(store.activeRequestCount()).toBe(1);
    expect(store.isLoading()).toBeTrue();
    expect(store.message()).toBe('読み込み中...');

    store.beginRequest('req-2', '保存しています…');
    expect(store.activeRequestCount()).toBe(2);
    expect(store.message()).toBe('保存しています…');
  });

  it('removes requests and clears the message when no requests remain', () => {
    store.beginRequest('req-1', '読み込み中...');
    store.beginRequest('req-2', '保存しています…');

    store.endRequest('req-2');
    expect(store.activeRequestCount()).toBe(1);
    expect(store.isLoading()).toBeTrue();
    expect(store.message()).toBe('読み込み中...');

    store.endRequest('req-1');
    expect(store.activeRequestCount()).toBe(0);
    expect(store.isLoading()).toBeFalse();
    expect(store.message()).toBeNull();
  });

  it('ignores unknown request identifiers', () => {
    store.beginRequest('req-1');
    store.endRequest('missing');

    expect(store.activeRequestCount()).toBe(1);
    expect(store.isLoading()).toBeTrue();
  });
});
