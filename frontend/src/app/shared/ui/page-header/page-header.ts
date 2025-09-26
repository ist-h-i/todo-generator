import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type HeadingLevel = 'h1' | 'h2' | 'h3';

/**
 * Shared page header used to render consistent hero sections across feature pages.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
})
export class PageHeaderComponent {
  /**
   * Label displayed above the title as an eyebrow.
   */
  @Input()
  public eyebrow?: string;

  /**
   * Main heading for the page.
   */
  @Input({ required: true })
  public title!: string;

  /**
   * Optional description rendered under the title.
   */
  @Input()
  public description?: string;

  /**
   * Controls the semantic level of the heading.
   */
  @Input()
  public headingLevel: HeadingLevel = 'h2';

  /**
   * When true the header content is centered for hero-style layouts.
   */
  @Input()
  public centered = false;
}
