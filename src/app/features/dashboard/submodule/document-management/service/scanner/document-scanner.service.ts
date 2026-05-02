import { Injectable } from '@angular/core';
import { OpencvLoaderService } from './opencv-loader.service';

export interface DetectedCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  confidence: number;
}

export type FilterMode = 'original' | 'magic' | 'bw' | 'grayscale';

@Injectable({ providedIn: 'root' })
export class DocumentScannerService {
  constructor(private loader: OpencvLoaderService) { }

  async ensureReady(): Promise<void> {
    await this.loader.load();
  }

  async detectCornersFromCanvas(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement): Promise<DetectedCorners | null> {
    await this.loader.load();
    const cv = (window as any).cv;
    if (!cv?.Mat) return null;

    const w = (source as any).videoWidth || (source as any).naturalWidth || (source as HTMLCanvasElement).width;
    const h = (source as any).videoHeight || (source as any).naturalHeight || (source as HTMLCanvasElement).height;
    if (!w || !h) return null;

    let img: any = null, gray: any = null, blurred: any = null, edged: any = null;
    let contours: any = null, hierarchy: any = null;
    try {
      img = cv.imread(source);
      const minArea = (img.cols * img.rows) * 0.12;

      gray = new cv.Mat();
      cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);

      blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

      edged = new cv.Mat();
      cv.Canny(blurred, edged, 50, 150);

      const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
      cv.dilate(edged, edged, kernel);
      kernel.delete();

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let bestQuad: any = null;
      let bestArea = 0;
      const N = contours.size();
      for (let i = 0; i < N; i++) {
        const c = contours.get(i);
        const area = cv.contourArea(c);
        if (area < minArea) { c.delete(); continue; }

        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);

        if (approx.rows === 4 && cv.isContourConvex(approx) && area > bestArea) {
          if (bestQuad) bestQuad.delete();
          bestQuad = approx;
          bestArea = area;
        } else {
          approx.delete();
        }
        c.delete();
      }

      if (!bestQuad) return null;

      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 4; i++) {
        pts.push({ x: bestQuad.data32S[i * 2], y: bestQuad.data32S[i * 2 + 1] });
      }
      bestQuad.delete();

      const ordered = this.orderCorners(pts);
      const totalArea = w * h;
      const confidence = Math.min(1, bestArea / (totalArea * 0.85));

      return { ...ordered, confidence };
    } catch (e) {
      console.warn('[scanner] detectCorners error', e);
      return null;
    } finally {
      img?.delete?.();
      gray?.delete?.();
      blurred?.delete?.();
      edged?.delete?.();
      contours?.delete?.();
      hierarchy?.delete?.();
    }
  }

  private orderCorners(pts: { x: number; y: number }[]) {
    const sumSorted = [...pts].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const diffSorted = [...pts].sort((a, b) => (a.y - a.x) - (b.y - b.x));
    return {
      topLeft: sumSorted[0],
      bottomRight: sumSorted[3],
      topRight: diffSorted[0],
      bottomLeft: diffSorted[3]
    };
  }

  async warpAndCrop(sourceImageUrl: string, corners: { x: number; y: number }[]): Promise<string> {
    await this.loader.load();
    const cv = (window as any).cv;
    const img = await this.loadImage(sourceImageUrl);

    const widthA = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const widthB = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
    const heightA = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
    const heightB = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

    let dstW = Math.round(Math.max(widthA, widthB));
    let dstH = Math.round(Math.max(heightA, heightB));

    const MAX_DIM = 2400;
    if (dstW > MAX_DIM || dstH > MAX_DIM) {
      const scale = MAX_DIM / Math.max(dstW, dstH);
      dstW = Math.round(dstW * scale);
      dstH = Math.round(dstH * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);

    let src: any = null, dst: any = null, M: any = null;
    let srcTri: any = null, dstTri: any = null;

    try {
      src = cv.imread(canvas);
      dst = new cv.Mat();
      srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        corners[0].x, corners[0].y,
        corners[1].x, corners[1].y,
        corners[2].x, corners[2].y,
        corners[3].x, corners[3].y
      ]);
      dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        dstW, 0,
        dstW, dstH,
        0, dstH
      ]);
      M = cv.getPerspectiveTransform(srcTri, dstTri);
      cv.warpPerspective(src, dst, M, new cv.Size(dstW, dstH), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

      const out = document.createElement('canvas');
      cv.imshow(out, dst);
      return out.toDataURL('image/jpeg', 0.92);
    } finally {
      src?.delete?.();
      dst?.delete?.();
      M?.delete?.();
      srcTri?.delete?.();
      dstTri?.delete?.();
    }
  }

  async applyFilter(dataUrl: string, mode: FilterMode): Promise<string> {
    if (mode === 'original') return dataUrl;
    await this.loader.load();
    const cv = (window as any).cv;
    const img = await this.loadImage(dataUrl);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);

    let src: any = null, dst: any = null, gray: any = null, bg: any = null, norm: any = null;

    try {
      src = cv.imread(canvas);
      dst = new cv.Mat();

      if (mode === 'grayscale') {
        cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
      } else if (mode === 'bw') {
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.adaptiveThreshold(gray, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 12);
      } else if (mode === 'magic') {
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        bg = new cv.Mat();
        const ksize = new cv.Size(31, 31);
        cv.GaussianBlur(gray, bg, ksize, 0, 0, cv.BORDER_DEFAULT);
        norm = new cv.Mat();
        cv.divide(gray, bg, norm, 255);
        cv.cvtColor(norm, dst, cv.COLOR_GRAY2RGBA);
        const lut = new cv.Mat(1, 256, cv.CV_8U);
        for (let i = 0; i < 256; i++) {
          const v = i / 255;
          const out = Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.max(0, (v - 0.05) / 0.95), 0.85))));
          lut.data[i] = out;
        }
        const channels = new cv.MatVector();
        cv.split(dst, channels);
        for (let i = 0; i < 3; i++) cv.LUT(channels.get(i), lut, channels.get(i));
        cv.merge(channels, dst);
        channels.delete();
        lut.delete();
      }

      const out = document.createElement('canvas');
      cv.imshow(out, dst);
      const isText = mode === 'bw' || mode === 'grayscale';
      return out.toDataURL(isText ? 'image/jpeg' : 'image/jpeg', isText ? 0.85 : 0.9);
    } finally {
      src?.delete?.();
      dst?.delete?.();
      gray?.delete?.();
      bg?.delete?.();
      norm?.delete?.();
    }
  }

  async measureBlur(source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement): Promise<number> {
    await this.loader.load();
    const cv = (window as any).cv;
    let img: any = null, gray: any = null, lap: any = null, mean: any = null, stdDev: any = null;
    try {
      img = cv.imread(source);
      gray = new cv.Mat();
      cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
      lap = new cv.Mat();
      cv.Laplacian(gray, lap, cv.CV_64F);
      mean = new cv.Mat();
      stdDev = new cv.Mat();
      cv.meanStdDev(lap, mean, stdDev);
      const sd = stdDev.data64F[0];
      return sd * sd;
    } catch {
      return Number.POSITIVE_INFINITY;
    } finally {
      img?.delete?.();
      gray?.delete?.();
      lap?.delete?.();
      mean?.delete?.();
      stdDev?.delete?.();
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
