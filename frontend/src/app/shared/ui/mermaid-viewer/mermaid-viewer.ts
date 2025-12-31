
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  viewChild
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
  imports: [],
  templateUrl: './mermaid-viewer.html',
  styleUrl: './mermaid-viewer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MermaidViewer implements AfterViewInit {
  public readonly code = input.required<string>();

  public readonly isRendering = signal(false);
  public readonly renderError = signal<string | null>(null);
  public readonly zoom = signal(1);
  public readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  public readonly hasCode = computed(() => this.code().trim().length > 0);
  public readonly canZoomIn = computed(() => this.zoom() < MermaidViewer.MAX_ZOOM);
  public readonly canZoomOut = computed(() => this.zoom() > MermaidViewer.MIN_ZOOM);
  public readonly canResetZoom = computed(() => this.zoom() !== 1);

  private readonly canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');

  private readonly viewReady = signal(false);
  private renderRequestId = 0;
  private static nextInstanceId = 0;
  private readonly instanceId = MermaidViewer.nextInstanceId++;
  private static readonly MIN_ZOOM = 0.25;
  private static readonly MAX_ZOOM = 4;
  private static readonly ZOOM_STEP = 0.1;

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

  public zoomIn(): void {
    this.setZoom(this.zoom() + MermaidViewer.ZOOM_STEP);
  }

  public zoomOut(): void {
    this.setZoom(this.zoom() - MermaidViewer.ZOOM_STEP);
  }

  public resetZoom(): void {
    this.zoom.set(1);
  }

  private setZoom(value: number): void {
    const clamped = Math.min(MermaidViewer.MAX_ZOOM, Math.max(MermaidViewer.MIN_ZOOM, value));
    const normalized = Math.round(clamped * 100) / 100;
    this.zoom.set(normalized);
  }

  private readonly normalizeMermaid = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const fenced = trimmed.match(/^```(?:mermaid)?\s*(?:\r?\n)([\s\S]*?)(?:\r?\n)```\s*$/i);
    return (fenced?.[1] ?? trimmed).trim();
  };

  private readonly resolveMermaidTheme = (): 'dark' | 'default' =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'default';

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
