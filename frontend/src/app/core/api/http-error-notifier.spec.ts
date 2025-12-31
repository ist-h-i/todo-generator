import { TestBed } from '@angular/core/testing';

import { HttpErrorNotifier } from './http-error-notifier';

describe('HttpErrorNotifier', () => {
  let service: HttpErrorNotifier;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpErrorNotifier],
    });

    service = TestBed.inject(HttpErrorNotifier);
  });

  it('publishes the latest error message and clears it on demand', () => {
    expect(service.message()).toBeNull();

    service.notify('初回のエラー');
    const firstSnapshot = service.message();
    expect(firstSnapshot).toBe('初回のエラー');

    service.notify('初回のエラー');
    expect(service.message()).toBe('初回のエラー');

    service.notify('再試行してください');
    expect(service.message()).toBe('再試行してください');

    service.clear();
    expect(service.message()).toBeNull();
  });
});
