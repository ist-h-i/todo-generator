import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageLayout } from './page-layout';

describe('PageLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageLayout],
    }).compileComponents();
  });

  it('renders the title as an h1 by default', () => {
    const fixture = TestBed.createComponent(PageLayout);
    fixture.componentRef.setInput('title', 'Dashboard');
    fixture.detectChanges();

    const titleEl = fixture.nativeElement.querySelector('h1') as HTMLElement | null;
    expect(titleEl?.textContent?.trim()).toBe('Dashboard');
  });

  it('renders the title using the provided heading level', () => {
    const fixture = TestBed.createComponent(PageLayout);
    fixture.componentRef.setInput('title', 'Reports');
    fixture.componentRef.setInput('headingLevel', 'h3');
    fixture.detectChanges();

    const titleEl = fixture.nativeElement.querySelector('h3') as HTMLElement | null;
    expect(titleEl?.textContent?.trim()).toBe('Reports');
  });

  it('adds the bleed modifier class when enabled', () => {
    const fixture = TestBed.createComponent(PageLayout);
    fixture.componentRef.setInput('title', 'Settings');
    fixture.componentRef.setInput('bleed', true);
    fixture.detectChanges();

    const bodyEl = fixture.nativeElement.querySelector(
      '.app-page-layout__body',
    ) as HTMLElement | null;
    expect(bodyEl?.classList.contains('app-page-layout__body--bleed')).toBeTrue();
  });
});

@Component({
  standalone: true,
  imports: [PageLayout],
  template: `
    <shared-page-layout [title]="title">
      <div pageTabs>Tabs</div>
      <p>Body</p>
    </shared-page-layout>
  `,
})
class PageLayoutHost {
  public readonly title = 'Projected';
}

describe('PageLayout content projection', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageLayoutHost],
    }).compileComponents();
  });

  it('projects pageTabs and body content', () => {
    const fixture = TestBed.createComponent(PageLayoutHost);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Tabs');
    expect(root.textContent).toContain('Body');
  });
});
