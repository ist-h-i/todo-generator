import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Visual indicator that a UI action triggers an AI request.
 *
 * Rendered as a compact gradient badge with a robot icon. Intended to be used as an inline icon
 * inside buttons, links, and headings.
 */
@Component({
  selector: 'shared-ai-mark',
  template: `
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="ai-mark__icon"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="4" r="1" />
      <path d="M12 5v3" />
      <rect x="5" y="8" width="14" height="12" rx="3" />
      <circle cx="10" cy="13" r="1" />
      <circle cx="14" cy="13" r="1" />
      <path d="M10 16h4" />
    </svg>
  `,
  styleUrl: './ai-mark.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
  },
})
export class AiMark {}

