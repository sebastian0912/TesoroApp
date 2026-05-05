import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    cv: any;
    Module: any;
  }
}

const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js';

@Injectable({ providedIn: 'root' })
export class OpencvLoaderService {
  private loadPromise: Promise<any> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

  isReady(): boolean {
    return isPlatformBrowser(this.platformId) && !!(window as any).cv && !!(window as any).cv.Mat;
  }

  load(): Promise<any> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(new Error('OpenCV only available in browser'));
    }
    if (this.isReady()) return Promise.resolve((window as any).cv);
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${OPENCV_URL}"]`);
      const finalize = () => {
        const w = window as any;
        if (w.cv && typeof w.cv.then === 'function') {
          w.cv.then((c: any) => { w.cv = c; resolve(c); }).catch(reject);
        } else if (w.cv && w.cv.Mat) {
          resolve(w.cv);
        } else {
          const start = Date.now();
          const tick = () => {
            if (w.cv && w.cv.Mat) return resolve(w.cv);
            if (Date.now() - start > 30000) return reject(new Error('Timeout cargando OpenCV'));
            setTimeout(tick, 60);
          };
          tick();
        }
      };

      if (existing) {
        existing.addEventListener('load', finalize, { once: true });
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar OpenCV')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = OPENCV_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = finalize;
      script.onerror = () => reject(new Error('No se pudo cargar OpenCV (revisa conexión)'));
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
