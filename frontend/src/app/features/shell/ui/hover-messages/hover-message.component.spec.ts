import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HoverMessageComponent } from './hover-message.component';
import { HoverMessageView } from '@features/shell/models/hover-message.types';

describe('HoverMessageComponent', () => {
  let fixture: ComponentFixture<HoverMessageComponent>;
  let component: HoverMessageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoverMessageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HoverMessageComponent);
    component = fixture.componentInstance;
  });

  it('renders the provided message text and severity attribute', () => {
    const message: HoverMessageView = {
      id: 1,
      text: 'テストメッセージ',
      severity: 'error',
      dismissing: false,
    };
    component.message = message;

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
    component.message = message;

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const icon = host.querySelector('.hover-message__icon');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelectorAll('svg').length).toBe(1);
  });
});
