import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type HeadingLevel = 'h1' | 'h2' | 'h3';

/**
 * Shared page header used to render consistent hero sections across feature pages.
 */
@Component({
  selector: 'shared-page-header',
  templateUrl: './page-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class PageHeader {
  /**
   * Label displayed above the title as an eyebrow.
   */
  public readonly eyebrow = input<string | undefined>();

  /**
   * Main heading for the page.
   */
  public readonly title = input.required<string>();

  /**
   * Optional description rendered under the title.
   */
  public readonly description = input<string | undefined>();

  /**
   * Controls the semantic level of the heading.
   */
  public readonly headingLevel = input<HeadingLevel>('h2');

  /**
   * When true the header content is centered for hero-style layouts.
   */
  public readonly centered = input(false);

  public readonly headerClass = computed(() =>
    [
      'grid gap-6',
      this.centered()
        ? 'justify-items-center text-center md:grid-cols-1'
        : 'md:grid-cols-[minmax(0,1fr)_auto] md:items-end',
    ].join(' '),
  );

  public readonly contentClass = computed(() =>
    ['grid max-w-6xl gap-3', this.centered() ? 'justify-items-center text-center md:mx-auto' : '']
      .filter((value) => value.length > 0)
      .join(' '),
  );

  public readonly bodyClass = computed(() =>
    ['mt-1 flex flex-wrap gap-3 empty:hidden', this.centered() ? 'justify-center' : '']
      .filter((value) => value.length > 0)
      .join(' '),
  );

  public readonly actionsClass = computed(() =>
    [
      'flex flex-wrap gap-3 empty:hidden',
      this.centered() ? 'justify-center' : 'justify-start md:justify-end',
    ].join(' '),
  );
}
