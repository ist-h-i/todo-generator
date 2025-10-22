import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HoverMessageStackComponent } from './hover-message-stack.component';
import { HoverMessageView } from '@features/shell/models/hover-message.types';

describe('HoverMessageStackComponent', () => {
  let fixture: ComponentFixture<HoverMessageStackComponent>;
  let component: HoverMessageStackComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoverMessageStackComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HoverMessageStackComponent);
    component = fixture.componentInstance;
  });

  it('hides the stack when there are no messages', () => {
    component.messages = [];

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('hover-message-stack--visible')).toBeFalse();
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('ul')).toBeNull();
  });

  it('renders each message and exposes accessibility metadata', () => {
    const messages: HoverMessageView[] = [
      { id: 1, text: 'テスト1', severity: 'system', dismissing: false },
      { id: 2, text: 'テスト2', severity: 'warning', dismissing: false },
    ];
    component.messages = messages;

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('hover-message-stack--visible')).toBeTrue();
    expect(host.getAttribute('aria-hidden')).toBeNull();

    const renderedMessages = host.querySelectorAll('li.hover-message');
    expect(renderedMessages.length).toBe(messages.length);
    expect(
      Array.from(renderedMessages).map((element) => element.getAttribute('data-severity')),
    ).toEqual(['system', 'warning']);
  });

  it('tracks messages by their identifier', () => {
    const message: HoverMessageView = {
      id: 42,
      text: 'identifier',
      severity: 'notification',
      dismissing: false,
    };
    expect(component.trackById(0, message)).toBe(42);
  });
});
