import { ChangeDetectionStrategy, Component, input } from '@angular/core';


import { PageHeader } from '@shared/ui/page-header/page-header';

type HeadingLevel = 'h1' | 'h2' | 'h3';

/**
 * Shell layout that provides consistent page headers and content spacing.
 */
@Component({
  selector: 'shared-page-layout',
  imports: [PageHeader],
  templateUrl: './page-layout.html',
  styleUrl: './page-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-page app-page-layout',
  },
})
export class PageLayout {
  /**
   * Eyebrow label displayed above the title.
   */
  public readonly eyebrow = input<string | undefined>();

  /**
   * Main title for the page.
   */
  public readonly title = input.required<string>();

  /**
   * Optional description rendered under the title.
   */
  public readonly description = input<string | undefined>();

  /**
   * Heading level passed to the shared page header.
   */
  public readonly headingLevel = input<HeadingLevel>('h1');

  /**
   * When true the content section spans the full width of the viewport.
   */
  public readonly bleed = input(false);

  /**
   * When true the shared page header centers its content.
   */
  public readonly headerCentered = input(false);
}
