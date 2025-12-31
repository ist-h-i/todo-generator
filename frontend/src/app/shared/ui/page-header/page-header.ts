import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

type HeadingLevel = 'h1' | 'h2' | 'h3';

/**
 * Shared page header used to render consistent hero sections across feature pages.
 */
@Component({
  selector: 'shared-page-header',
  imports: [NgClass],
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
}
