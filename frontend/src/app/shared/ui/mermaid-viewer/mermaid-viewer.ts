import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import type mermaidType from 'mermaid';

type MermaidAPI = typeof mermaidType;
type SvgSize = Readonly<{ width: number; height: number }>;

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
  public readonly zoomLevel = signal(1);
  public readonly zoomPercent = computed(() => Math.round(this.zoomLevel() * 100));

  private readonly documentRef = inject(DOCUMENT);
  private readonly canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');

  private readonly viewReady = signal(false);
  private readonly baseSize = signal<SvgSize | null>(null);
  private renderRequestId = 0;
  private static nextInstanceId = 0;
  private readonly instanceId = MermaidViewer.nextInstanceId++;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 2.5;
  private readonly zoomStep = 0.1;
  public readonly canZoomIn = computed(() => this.zoomLevel() < this.maxZoom);
  public readonly canZoomOut = computed(() => this.zoomLevel() > this.minZoom);
  public readonly hasDiagram = computed(() => this.baseSize() !== null);

  private readonly renderEffect = effect(() => {
    const code = this.code();
    if (!this.viewReady()) {
      return;
    }

    const requestId = (this.renderRequestId += 1);
    void this.render(code, requestId);
  });

  private readonly zoomEffect = effect(() => {
    const zoomLevel = this.zoomLevel();
    const baseSize = this.baseSize();
    const host = this.canvas()?.nativeElement;
    if (!host || !baseSize) {
      return;
    }

    const svg = host.querySelector('svg');
    if (!svg) {
      return;
    }

    this.applyZoom(svg, zoomLevel, baseSize);
  });

  public ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  public zoomIn(): void {
    this.updateZoom(this.zoomStep);
  }

  public zoomOut(): void {
    this.updateZoom(-this.zoomStep);
  }

  public resetZoom(): void {
    this.zoomLevel.set(1);
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
    this.baseSize.set(null);

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
      const svgElement = host.querySelector('svg');
      if (svgElement) {
        const baseSize = this.readSvgBaseSize(svgElement);
        this.baseSize.set(baseSize);
      }
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

  private readonly updateZoom = (delta: number): void => {
    const current = this.zoomLevel();
    const next = this.clampZoom(this.roundZoom(current + delta));
    if (next !== current) {
      this.zoomLevel.set(next);
    }
  };

  private readonly clampZoom = (value: number): number =>
    Math.min(this.maxZoom, Math.max(this.minZoom, value));

  private readonly roundZoom = (value: number): number => Math.round(value * 100) / 100;

  private readonly parseSvgLength = (value: string | null): number | null => {
    if (!value) {
      return null;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  private readonly readSvgBaseSize = (svg: SVGSVGElement): SvgSize | null => {
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+/).map(Number);
      if (parts.length === 4) {
        const width = parts[2];
        const height = parts[3];
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    const width = this.parseSvgLength(svg.getAttribute('width'));
    const height = this.parseSvgLength(svg.getAttribute('height'));
    if (width !== null && height !== null) {
      return { width, height };
    }

    try {
      const box = svg.getBBox();
      if (box.width > 0 && box.height > 0) {
        return { width: box.width, height: box.height };
      }
    } catch {
      return null;
    }

    return null;
  };

  private readonly applyZoom = (
    svg: SVGSVGElement,
    zoomLevel: number,
    baseSize: SvgSize,
  ): void => {
    const width = Math.max(1, baseSize.width * zoomLevel);
    const height = Math.max(1, baseSize.height * zoomLevel);
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
  };
}
