import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HoverMessage } from './hover-message';
import { HoverMessages } from '@features/shell/data/hover-messages';
import { HoverMessageView } from '@features/shell/models/hover-message.types';

describe('HoverMessage', () => {
  let fixture: ComponentFixture<HoverMessage>;
  let hoverMessages: { dismiss: jasmine.Spy };

  beforeEach(async () => {
    hoverMessages = {
      dismiss: jasmine.createSpy('dismiss'),
    };

    await TestBed.configureTestingModule({
      imports: [HoverMessage],
      providers: [{ provide: HoverMessages, useValue: hoverMessages }],
    }).compileComponents();

    fixture = TestBed.createComponent(HoverMessage);
  });

  it('renders the provided message text and severity attribute', () => {
    const message: HoverMessageView = {
      id: 1,
      text: 'テストメッセージ',
      severity: 'error',
      dismissing: false,
    };
    fixture.componentRef.setInput('message', message);

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('data-severity')).toBe('error');
    expect(host.textContent).toContain('テストメッセージ');
  });

  it('exposes an icon container for assistive technologies', () => {
    const message: HoverMessageView = {
      id: 2,
      text: '完了しました',
      severity: 'notification',
      dismissing: false,
    };
    fixture.componentRef.setInput('message', message);

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const icon = host.querySelector('.hover-message__icon');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelectorAll('svg').length).toBe(1);
  });

  it('allows dismissing error messages with the close button', () => {
    const message: HoverMessageView = {
      id: 3,
      text: 'dismissable',
      severity: 'error',
      dismissing: false,
    };
    fixture.componentRef.setInput('message', message);

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const closeButton = host.querySelector(
      'button.hover-message__close',
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();

    closeButton?.click();
    expect(hoverMessages.dismiss).toHaveBeenCalledWith(3);
  });
});
