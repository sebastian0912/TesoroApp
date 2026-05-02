import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface OcrPageResult {
  text: string;
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    baseline?: { x0: number; y0: number; x1: number; y1: number };
    page_width?: number;
    page_height?: number;
  }>;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  private workerPromise: Promise<any> | null = null;
  private worker: any = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  private async ensureWorker(): Promise<any> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('OCR solo disponible en navegador');
    }
    if (this.worker) return this.worker;
    if (this.workerPromise) return this.workerPromise;

    this.workerPromise = (async () => {
      const tess: any = await import('tesseract.js');
      const w = await tess.createWorker('spa', 1, {
        logger: () => { }
      });
      this.worker = w;
      return w;
    })();

    return this.workerPromise;
  }

  async recognize(dataUrl: string): Promise<OcrPageResult> {
    const w = await this.ensureWorker();
    const { data } = await w.recognize(dataUrl, {}, { blocks: true });

    const words: OcrPageResult['words'] = [];
    const blocks = data.blocks || [];
    for (const b of blocks) {
      for (const par of b.paragraphs || []) {
        for (const ln of par.lines || []) {
          for (const wd of ln.words || []) {
            if (!wd.text || !wd.text.trim()) continue;
            words.push({
              text: wd.text,
              bbox: wd.bbox,
              baseline: ln.baseline
            });
          }
        }
      }
    }

    const probe = await this.imageDims(dataUrl);
    return {
      text: data.text || '',
      words,
      width: probe.w,
      height: probe.h
    };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      try { await this.worker.terminate(); } catch { }
      this.worker = null;
      this.workerPromise = null;
    }
  }

  private imageDims(src: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    });
  }
}
