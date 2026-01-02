import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import type mermaidType from 'mermaid';

type MermaidAPI = typeof mermaidType;

let mermaidApiPromise: Promise<MermaidAPI> | null = null;

const loadMermaid = async (): Promise<MermaidAPI> => {
  if (!mermaidApiPromise) {
    mermaidApiPromise = import('mermaid').then((module) => module.default);
  }
  return mermaidApiPromise;
};

@Component({
  selector: 'shared-mermaid-viewer',
  templateUrl: './mermaid-viewer.html',
  styleUrl: './mermaid-viewer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MermaidViewer implements AfterViewInit {
  public readonly code = input.required<string>();

  public readonly isRendering = signal(false);
  public readonly renderError = signal<string | null>(null);

  private readonly documentRef = inject(DOCUMENT);
  private readonly canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');

  private readonly viewReady = signal(false);
  private renderRequestId = 0;
  private static nextInstanceId = 0;
  private readonly instanceId = MermaidViewer.nextInstanceId++;

  private readonly renderEffect = effect(() => {
    const code = this.code();
    if (!this.viewReady()) {
      return;
    }

    const requestId = (this.renderRequestId += 1);
    void this.render(code, requestId);
  });

  public ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  private readonly normalizeMermaid = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const fenced = trimmed.match(/^```(?:mermaid)?\s*(?:\r?\n)([\s\S]*?)(?:\r?\n)```\s*$/i);
    return (fenced?.[1] ?? trimmed).trim();
  };

  private readonly resolveMermaidTheme = (): 'dark' | 'default' => {
    const root = this.documentRef?.documentElement;
    return root?.classList.contains('dark') ? 'dark' : 'default';
  };

  private readonly render = async (code: string, requestId: number): Promise<void> => {
    const host = this.canvas()?.nativeElement;
    if (!host) {
      return;
    }

    const normalized = this.normalizeMermaid(code);

    host.innerHTML = '';
    this.renderError.set(null);

    if (!normalized) {
      this.isRendering.set(false);
      return;
    }

    this.isRendering.set(true);

    try {
      const mermaid = await loadMermaid();

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: this.resolveMermaidTheme(),
        flowchart: {
          htmlLabels: false,
          useMaxWidth: false,
        },
        sequence: {
          useMaxWidth: false,
        },
      });

      const { svg, bindFunctions } = await mermaid.render(
        `mermaid-viewer-${this.instanceId}-${requestId}`,
        normalized,
      );
      if (requestId !== this.renderRequestId) {
        return;
      }

      host.innerHTML = svg;
      bindFunctions?.(host);
    } catch {
      if (requestId !== this.renderRequestId) {
        return;
      }

      host.innerHTML = '';
      this.renderError.set('Mermaid の描画に失敗しました。');
    } finally {
      if (requestId === this.renderRequestId) {
        this.isRendering.set(false);
      }
    }
  };
}
