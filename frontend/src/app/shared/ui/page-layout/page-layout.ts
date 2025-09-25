import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PageHeaderComponent } from '@shared/ui/page-header/page-header';

type HeadingLevel = 'h1' | 'h2' | 'h3';

/**
 * Shell layout that provides consistent page headers and content spacing.
 */
@Component({
  selector: 'app-page-layout',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './page-layout.html',
  styleUrl: './page-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-page app-page-layout',
  },
})
export class PageLayoutComponent {
  /**
   * Eyebrow label displayed above the title.
   */
  @Input()
  public eyebrow?: string;

  /**
   * Main title for the page.
   */
  @Input({ required: true })
  public title!: string;

  /**
   * Optional description rendered under the title.
   */
  @Input()
  public description?: string;

  /**
   * Heading level passed to the shared page header.
   */
  @Input()
  public headingLevel: HeadingLevel = 'h1';

  /**
   * When true the content section spans the full width of the viewport.
   */
  @Input()
  public bleed = false;
}
