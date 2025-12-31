import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HoverMessageStack } from './hover-message-stack';
import { HoverMessageView } from '@features/shell/models/hover-message.types';

describe('HoverMessageStack', () => {
  let fixture: ComponentFixture<HoverMessageStack>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoverMessageStack],
    }).compileComponents();

    fixture = TestBed.createComponent(HoverMessageStack);
  });

  it('hides the stack when there are no messages', () => {
    fixture.componentRef.setInput('messages', []);

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
    fixture.componentRef.setInput('messages', messages);

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
});
