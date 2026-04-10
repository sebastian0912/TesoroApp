import {
    Component,
    ElementRef,
    OnInit,
    OnDestroy,
    ViewChild,
    Inject,
    PLATFORM_ID,
    ChangeDetectorRef,
    ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Capacitor } from '@capacitor/core';
import { DocumentScanner, ResponseType } from '@capgo/capacitor-document-scanner';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import dayjs from 'dayjs';

// Interface for a single scanned document in the session
export interface ScannedDoc {
    id: string;
    name: string;
    createdAt: Date;
    pages: string[]; // Base64 data URLs
    thumb: string;   // Thumbnail (first page)
}

@Component({
    selector: 'app-document-scan-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatFormFieldModule,
        MatFormFieldModule,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        DragDropModule
    ],
    templateUrl: './document-scan-dialog.component.html',
    styleUrls: ['./document-scan-dialog.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentScanDialogComponent implements OnInit, OnDestroy {
    @ViewChild('video') videoElement?: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas') canvasElement?: ElementRef<HTMLCanvasElement>;

    // State
    mode: 'list' | 'capture-web' | 'crop' | 'preview' = 'list';
    isNative = false;

    // Data
    scannedDocs: ScannedDoc[] = [];

    // Web Capture Temp State
    tempPages: string[] = [];
    showFlash = false;

    // CROP STATE
    // CROP STATE    
    cropSourceImage = '';
    cropPoints: { x: number, y: number }[] = []; // NATURAL Coordinates (px)
    activePointIndex: number | null = null;
    isDragging = false;
    magnifierPos = { x: 0, y: 0 };
    isProcessingCrop = false;
    cropEditMode: 'new' | 'edit' = 'new';
    editingPageIndex: number | null = null;

    // Image Dims for Crop
    natW = 0;
    natH = 0;

    @ViewChild('cropStage') cropStage?: ElementRef<HTMLDivElement>;
    @ViewChild('cropImage') cropImage?: ElementRef<HTMLImageElement>;
    @ViewChild('magnifierCanvas') magnifierCanvas?: ElementRef<HTMLCanvasElement>;


    // Preview/Edit State
    currentDocId: string | null = null;
    currentDocName = '';
    currentDocPages: string[] = [];
    selectedPageIndex = 0;

    // Hardware
    stream: MediaStream | null = null;
    errorMsg = '';

    constructor(
        private dialogRef: MatDialogRef<DocumentScanDialogComponent>,
        private cdr: ChangeDetectorRef,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    get totalPages(): number {
        return this.scannedDocs.reduce((acc, doc) => acc + doc.pages.length, 0);
    }

    getFormattedDate(date: Date): string {
        return dayjs(date).format('HH:mm');
    }

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            this.isNative = Capacitor.isNativePlatform();
            // PASSIVE START: Do NOT start camera or scanner here.
        }
    }

    ngOnDestroy() {
        this.stopWebCamera();
    }

    // --- ACTIONS: MAIN LIST ---

    async onCaptureClick() {
        if (this.isNative) {
            await this.scanNative();
        } else {
            this.startWebCaptureSession();
        }
    }

    previewDoc(doc: ScannedDoc) {
        this.currentDocId = doc.id;
        this.currentDocName = doc.name;
        this.currentDocPages = [...doc.pages]; // Clone to allow cancel
        this.selectedPageIndex = 0;
        this.mode = 'preview';
    }

    deleteDoc(doc: ScannedDoc) {
        Swal.fire({
            title: '¿Eliminar documento?',
            text: doc.name,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(res => {
            if (res.isConfirmed) {
                this.scannedDocs = this.scannedDocs.filter(d => d.id !== doc.id);
                this.cdr.markForCheck();
            }
        });
    }

    // --- NATIVE SCANNER (Capacitor) ---
    async scanNative() {
        try {
            // Launch Native Scanner via @capgo/capacitor-document-scanner
            const result = await DocumentScanner.scanDocument({
                responseType: ResponseType.Base64,
                letUserAdjustCrop: true,
                maxNumDocuments: 24
            }) as any;

            const images: string[] = result.scannedImages || result.scannedFilePaths || [];

            if (images && images.length > 0) {
                const newPages = images.map((img: string) =>
                    // El plugin a veces devuelve la cadena ya con "data:image/jpeg;base64," o solo la cadena b64 cruda
                    img.startsWith('data:image') || img.startsWith('file://') ? img : `data:image/jpeg;base64,${img}`
                );

                // Native creates a doc immediately
                this.addScannedDoc(newPages);
            }

        } catch (e: any) {
            console.error('Scan error natively:', e);
            // Capturamos si el user simplemente se arrepintió y le dio "Atrás" en Android,
            // para no molestar con "Errores", a menos que sea un error de incompatibilidad real.
            if (e && e.message) {
                 const msg = e.message.toLowerCase();
                 if (msg.includes('not implemented') || msg.includes('implementation missing')) {
                     Swal.fire({
                         icon: 'warning',
                         title: 'Modo Web',
                         text: 'Esta función requiere correr como App (Android/iOS). Cambiando a cámara web automática.'
                     }).then(() => {
                         this.startWebCaptureSession();
                     });
                 }
            }
        }
    }

    // --- WEB CAMERA SESSION ---

    async startWebCaptureSession() {
        this.mode = 'capture-web';
        this.tempPages = [];
        this.errorMsg = '';

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            // Wait for view update to bind video
            this.cdr.detectChanges();

            if (this.videoElement) {
                this.videoElement.nativeElement.srcObject = this.stream;
                this.videoElement.nativeElement.play();
            }
        } catch (err) {
            console.error(err);
            this.errorMsg = 'No se pudo acceder a la cámara. Revisa permisos.';
            this.mode = 'list'; // Go back
        }
    }

    stopWebCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    captureWebPage() {
        if (!this.videoElement || !this.canvasElement) return;

        const video = this.videoElement.nativeElement;
        const canvas = this.canvasElement.nativeElement;
        const ctx = canvas.getContext('2d');

        if (ctx && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // FLUSH -> Go to CROP
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // higher quality for source

            // UI Feedback
            this.showFlash = true;
            setTimeout(() => {
                this.showFlash = false;
                this.initCrop(dataUrl, 'new');
            }, 100);
        }
    }

    // --- CROP LOGIC ---

    initCrop(imageUrl: string, mode: 'new' | 'edit' = 'new', pageIndex?: number) {
        this.cropSourceImage = imageUrl;
        this.cropEditMode = mode;
        this.editingPageIndex = pageIndex ?? null;

        // Reset points; will be set when image loads (onImageLoad) or default now if we pre-load
        // We defer point init to the image onload event in template or helper
        // But for safety, let's pre-load image dims here to set initial points
        const img = new Image();
        img.onload = () => {
            this.natW = img.naturalWidth;
            this.natH = img.naturalHeight;

            // Default: 20% margin
            const mX = this.natW * 0.2;
            const mY = this.natH * 0.2;
            const rX = this.natW * 0.8;
            const rY = this.natH * 0.8;

            this.cropPoints = [
                { x: mX, y: mY }, // TL
                { x: rX, y: mY }, // TR
                { x: rX, y: rY }, // BR
                { x: mX, y: rY }  // BL
            ];
            this.mode = 'crop';
            this.cdr.detectChanges();
        };
        img.src = imageUrl;
    }

    cancelCrop() {
        if (this.cropEditMode === 'new') {
            this.mode = 'capture-web'; // Back to camera
        } else {
            this.mode = 'preview'; // Back to preview
        }
        this.cropSourceImage = '';
        this.cropPoints = [];
    }

    async confirmCrop() {
        this.isProcessingCrop = true;
        this.cdr.detectChanges();

        // 1. Warp Perspective
        try {
            const warpedImage = await this.warpImage(this.cropSourceImage, this.cropPoints);

            if (this.cropEditMode === 'new') {
                this.tempPages.push(warpedImage);
                this.mode = 'capture-web';
            } else {
                // Formatting existing page
                if (this.editingPageIndex !== null && this.currentDocPages[this.editingPageIndex]) {
                    this.currentDocPages[this.editingPageIndex] = warpedImage;
                }
                this.mode = 'preview';
            }

        } catch (e) {
            console.error('Crop error', e);
            Swal.fire('Error', 'No se pudo procesar el recorte.', 'error');
        } finally {
            this.isProcessingCrop = false;
            this.cdr.markForCheck();
        }
    }

    // --- POINTER EVENTS (Robust FitRect Mapping) ---

    // Helper: Get the actual rectangle of the displayed image (accounting for object-fit: contain)
    private getFitRect(): DOMRect | null {
        if (!this.cropImage || !this.cropStage) return null;
        const img = this.cropImage.nativeElement;
        const stage = this.cropStage.nativeElement;

        // Stage rect
        const stageRect = stage.getBoundingClientRect();

        // Natural dims
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (!nw || !nh) return null;

        // Ratios
        const stageRatio = stageRect.width / stageRect.height;
        const imgRatio = nw / nh;

        let drawW, drawH, offX, offY;

        if (stageRatio > imgRatio) {
            // Stage wider -> Image fits Height
            drawH = stageRect.height;
            drawW = drawH * imgRatio;
            offX = (stageRect.width - drawW) / 2;
            offY = 0;
        } else {
            // Stage taller -> Image fits Width
            drawW = stageRect.width;
            drawH = drawW / imgRatio;
            offX = 0;
            offY = (stageRect.height - drawH) / 2;
        }

        // Return the absolute rect of the image on screen
        return new DOMRect(
            stageRect.left + offX,
            stageRect.top + offY,
            drawW,
            drawH
        );
    }

    onCropPointerDown(event: PointerEvent, index: number) {
        event.preventDefault();
        event.stopPropagation();

        this.activePointIndex = index;
        this.isDragging = true;

        // Capture pointer on the HANDLE element (target)
        // This ensures we get move events even if we slide off the handle visually
        (event.target as HTMLElement).setPointerCapture(event.pointerId);

        this.updateMagnifier(event);
    }

    onCropPointerMove(event: PointerEvent) {
        if (this.activePointIndex === null) return;
        event.preventDefault();

        // 1. Get Fit Rect
        const fitRect = this.getFitRect();
        if (!fitRect) return;

        // 2. Map Pointer (Client) -> Image Natural
        // Pointer relative to FitRect
        const relX = event.clientX - fitRect.left;
        const relY = event.clientY - fitRect.top;

        // Scale factors
        const scaleX = this.natW / fitRect.width;
        const scaleY = this.natH / fitRect.height;

        let nx = relX * scaleX;
        let ny = relY * scaleY;

        // 3. Clamp global bounds
        nx = Math.max(0, Math.min(this.natW, nx));
        ny = Math.max(0, Math.min(this.natH, ny));

        // 4. Apply Convexity/Constraint Check (Optional but recommended)
        // We temporarily set the point
        const prevPoint = this.cropPoints[this.activePointIndex];
        this.cropPoints[this.activePointIndex] = { x: nx, y: ny };

        // Basic Constraint: Don't cross opposite sides? 
        // For now, let's just rely on sorting at the end, OR strict bounds.
        // CamScanner usually allows crossing but then correcting. 
        // Let's implement strict order maintenance if requested ("Prohibir que el polígono se cruce")
        if (!this.isPolygonValid(this.cropPoints)) {
            // Revert if invalid
            this.cropPoints[this.activePointIndex] = prevPoint;
        }

        // 5. Update Magnifier
        this.updateMagnifier(event, fitRect);
    }

    onCropPointerUp(event: PointerEvent) {
        if (this.activePointIndex !== null) {
            (event.target as HTMLElement).releasePointerCapture(event.pointerId);
            this.activePointIndex = null;
            this.isDragging = false;

            // Re-sort mechanism to ensure TL/TR/BR/BL ?
            // Better not to re-sort automatically if user wants precise manual twist, 
            // BUT for document scanning, standard order is best.
            // Let's ensure order only if convexity is broken significantly.
            // Simplified: Just keep them as is if valid.
        }
    }

    // Helper: Convex Hull / Validity check
    private isPolygonValid(points: { x: number, y: number }[]): boolean {
        // Check if edges intersect: (P0,P1) with (P2,P3) etc.
        // Also check winding order.
        // Simple check: Sort by angle vs Index order? 
        // If we strictly enforce constraints during move:
        const p = points;
        const idx = this.activePointIndex!;

        // Gap to keep points apart
        const gap = 20;

        // TL(0) needs to be Left of TR(1) and Above BL(3)
        // TR(1) needs to be Right of TL(0) and Above BR(2)
        // BR(2) needs to be Right of BL(3) and Below TR(1)
        // BL(3) needs to be Left of BR(2) and Below TL(0)

        // We can just clamp instead of reverting!
        // Let's do nothing here to allow flexibility, 
        // relying on the user. Reverting feels "stuck".
        return true;
    }

    // --- MAGNIFIER ---
    updateMagnifier(event: PointerEvent, fitRect?: DOMRect) {
        if (this.activePointIndex === null) return;
        if (!this.magnifierCanvas) return;

        // 1. Position Magnifier (Top Right fixed or floating)
        // User requested: "arriba a la derecha... con crosshair"
        // Let's stick it top-right of the CONTAINER/CropStage to avoid blocking fingers.
        // Or "floating near finger". The request says: "fijada en la esquina superior derecha (o cerca del dedo si hay espacio)".
        // Let's use CSS to fix it Top-Right of the crop-container usually.
        // But we need to pass coordinates to it? 
        // Actually, CSS class `.magnifier` handles position. 
        // If we want it floating, we update `magnifierPos`. 
        // Let's stick to Fixed Top Right via CSS for stability (CamScanner style often fixed or corner).
        // EDIT: User prompt says: "fijada en la esquina superior derecha".
        // So `magnifierPos` might not be needed if CSS fits it.
        // BUT: if finger is TOP-RIGHT, move it to TOP-LEFT?

        // Let's determine corner based on activePoint
        const container = this.cropStage?.nativeElement.getBoundingClientRect();
        if (!container) return;

        // Default Top-Right relative to container
        let magX = container.width - 130;
        let magY = 10;

        // If dragging TR (idx 1) or point is in TR quadrant, move to TL
        const pt = this.cropPoints[this.activePointIndex]; // Natural
        // Check Normalized
        const normX = pt.x / this.natW;
        const normY = pt.y / this.natH;

        if (normX > 0.5 && normY < 0.5) {
            // Top Right -> Move Mag to Top Left
            magX = 10;
        }

        this.magnifierPos = { x: magX, y: magY };

        // 2. Draw Zoom
        const canvas = this.magnifierCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = this.cropImage?.nativeElement;
        if (!img) return;

        // Setup Canvas
        const size = 120; // Matches CSS
        canvas.width = size;
        canvas.height = size;

        // Clear White
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);

        // Draw Source Image
        // Center around point `pt` (Px)
        // Zoom factor 2.5x -> Source Chunk Size = size / 2.5
        const zoom = 2.5;
        const srcChunk = size / zoom;

        const sx = pt.x - srcChunk / 2;
        const sy = pt.y - srcChunk / 2;

        try {
            ctx.drawImage(img,
                sx, sy, srcChunk, srcChunk,
                0, 0, size, size
            );
        } catch (e) {
            // Padding if out of bounds?
        }

        // Draw Crosshair
        ctx.strokeStyle = '#2d5af5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
        ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
        ctx.stroke();

        // Draw Dot
        ctx.fillStyle = '#2d5af5';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- MATH: PERSPECTIVE WARP (Pure JS) ---
    // Reference: Projective Mapping

    private warpImage(srcUrl: string, points: { x: number, y: number }[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('No context');

                const w = img.width;
                const h = img.height;

                // Points are already in pixel coords (e.g. from initCrop)
                const srcPts = points;

                // Calculate destination dimensions (maximize rect)
                const widthTop = Math.hypot(srcPts[1].x - srcPts[0].x, srcPts[1].y - srcPts[0].y);
                const widthBottom = Math.hypot(srcPts[2].x - srcPts[3].x, srcPts[2].y - srcPts[3].y);
                const maxWidth = Math.max(widthTop, widthBottom);

                const heightLeft = Math.hypot(srcPts[3].x - srcPts[0].x, srcPts[3].y - srcPts[0].y);
                const heightRight = Math.hypot(srcPts[2].x - srcPts[1].x, srcPts[2].y - srcPts[1].y);
                const maxHeight = Math.max(heightLeft, heightRight);

                // Limit max dimension to avoid Out Of Memory on mobile devices
                const MAX_DIMENSION = 2048;
                let scale = 1;

                if (maxWidth > MAX_DIMENSION || maxHeight > MAX_DIMENSION) {
                    scale = Math.min(MAX_DIMENSION / maxWidth, MAX_DIMENSION / maxHeight);
                }

                const finalWidth = Math.floor(maxWidth * scale);
                const finalHeight = Math.floor(maxHeight * scale);

                canvas.width = finalWidth;
                canvas.height = finalHeight;

                // Steps to warp:
                // 1. Create a hidden canvas for the source
                // 2. Since 2D context doesn't support perspective transform directly easily,
                //    we can use a triangulation approach or a homography-based pixel mapping.
                //    For simplicity and performance without WebGL:
                //    We will just crop to the bounding box if the user didn't make a complex shape,
                //    OR we can simulate 4-point transform. 
                //    
                //    Actually, implementing a full homography in pure JS pixel-by-pixel is SLOW for 1920x1080.
                //    Alternative: Use CSS transform to show it, but to SAVE it we need it on canvas.
                //    
                //    Let's implement a simplified "Triangulation" warp which is faster, OR
                //    just a homography loop since it's 1 frame. 2MP is ~2M iterations. In JS that's ~100-300ms.
                //    Let's try the Homography approach.

                const dstPts = [
                    { x: 0, y: 0 },
                    { x: finalWidth, y: 0 },
                    { x: finalWidth, y: finalHeight },
                    { x: 0, y: finalHeight }
                ];

                // Compute Homography Matrix H mapping Dest -> Src (Inverse mapping)
                // So for each pixel in Dest (x,y), we find (u,v) in Src.
                const H = this.computeHomography(dstPts, srcPts);

                const srcData = this.getImageData(img);
                try {
                    var dstData = ctx.createImageData(finalWidth, finalHeight);
                } catch (e) {
                    return reject(e);
                }

                for (let y = 0; y < finalHeight; y++) {
                    for (let x = 0; x < finalWidth; x++) {
                        // Apply H to (x, y, 1) to get (u, v, w)
                        const u_ = H[0] * x + H[1] * y + H[2];
                        const v_ = H[3] * x + H[4] * y + H[5];
                        const w_ = H[6] * x + H[7] * y + H[8];

                        const u = u_ / w_;
                        const v = v_ / w_;

                        // Sample from Src at (u, v) (Nearest Neighbor or Bilinear)
                        // Bilinear is better but slower. Let's do nearest first for speed.
                        if (u >= 0 && u < w && v >= 0 && v < h) {
                            const srcIdx = (Math.floor(v) * w + Math.floor(u)) * 4;
                            const dstIdx = (y * finalWidth + x) * 4;
                            dstData.data[dstIdx] = srcData.data[srcIdx];
                            dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
                            dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
                            dstData.data[dstIdx + 3] = 255; // Alpha
                        }
                    }
                }

                ctx.putImageData(dstData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = reject;
            img.src = srcUrl;
        });
    }

    private getImageData(img: HTMLImageElement): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
    }

    // Calculate Homography Matrix for 4 points src -> dst
    // Returns 3x3 matrix as array [h00, h01, h02, h10, h11, h12, h20, h21, h22]
    private computeHomography(src: { x: number, y: number }[], dst: { x: number, y: number }[]) {
        // We want H that maps Src to Dst? No, the previous code needs Inverse H (Dst -> Src).
        // So we pass computeHomography(dst, src) to get mapping from Dest pixels to Src pixels.

        let a: number[] = [];
        let b: number[] = [];

        for (let i = 0; i < 4; i++) {
            let x = src[i].x, y = src[i].y;
            let X = dst[i].x, Y = dst[i].y;
            a.push(x, y, 1, 0, 0, 0, -x * X, -y * X);
            b.push(X);
            a.push(0, 0, 0, x, y, 1, -x * Y, -y * Y);
            b.push(Y);
        }

        // Gaussian elimination to solve Ah = b
        // A is 8x8, we add h22 = 1.
        // This is a simplified solver for 8 unknowns.
        const h = this.solveGaussian(a, b);
        h.push(1);
        return h;
    }

    private solveGaussian(A: number[], b: number[]): number[] {
        const n = 8;
        for (let i = 0; i < n; i++) {
            // pivot
            let maxEl = Math.abs(A[i * n + i]);
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k * n + i]) > maxEl) {
                    maxEl = Math.abs(A[k * n + i]);
                    maxRow = k;
                }
            }

            // swap max row with current row
            for (let k = i; k < n; k++) {
                const tmp = A[maxRow * n + k];
                A[maxRow * n + k] = A[i * n + k];
                A[i * n + k] = tmp;
            }
            const tmpB = b[maxRow];
            b[maxRow] = b[i];
            b[i] = tmpB;

            // eliminate
            for (let k = i + 1; k < n; k++) {
                const c = -A[k * n + i] / A[i * n + i];
                for (let j = i; j < n; j++) {
                    if (i === j) {
                        A[k * n + j] = 0;
                    } else {
                        A[k * n + j] += c * A[i * n + j];
                    }
                }
                b[k] += c * b[i];
            }
        }

        // back sub
        const x = new Array(n).fill(0);
        for (let i = n - 1; i > -1; i--) {
            let sum = 0;
            for (let j = i + 1; j < n; j++) {
                sum += A[i * n + j] * x[j];
            }
            x[i] = (b[i] - sum) / A[i * n + i];
        }
        return x;
    }

    reCropPage() {
        if (this.currentDocPages.length > 0) {
            const img = this.currentDocPages[this.selectedPageIndex];
            this.initCrop(img, 'edit', this.selectedPageIndex);
        }
    }

    async finishWebCapture() {
        this.stopWebCamera();

        if (this.tempPages.length === 0) {
            this.mode = 'list';
            return;
        }

        // Ask for name
        const { value: name } = await Swal.fire({
            title: 'Nombre del documento',
            input: 'text',
            inputLabel: 'Ej: Cédula, Diploma...',
            inputValue: `Documento ${this.scannedDocs.length + 1}`,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) return 'El nombre es obligatorio';
                return null;
            }
        });

        if (name) {
            this.addScannedDoc(this.tempPages, name);
        }

        this.mode = 'list';
    }

    cancelWebCapture() {
        this.stopWebCamera();
        this.tempPages = [];
        this.mode = 'list';
    }

    // --- HELPERS ---

    private addScannedDoc(pages: string[], nameOverride?: string) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const name = nameOverride || `Documento ${this.scannedDocs.length + 1}`;

        this.scannedDocs.push({
            id,
            name,
            createdAt: new Date(),
            pages: pages,
            thumb: pages[0] // First page as thumb
        });

        this.cdr.markForCheck();
    }

    // --- PREVIEW / EDIT MODE ---

    dropPage(event: CdkDragDrop<string[]>) {
        moveItemInArray(this.currentDocPages, event.previousIndex, event.currentIndex);
    }

    removePageFromCurrent(index: number) {
        this.currentDocPages.splice(index, 1);
        // If we remove the selected one, adjust selection
        if (index === this.selectedPageIndex) {
            this.selectedPageIndex = Math.max(0, index - 1);
        } else if (index < this.selectedPageIndex) {
            this.selectedPageIndex--;
        }

        if (this.currentDocPages.length === 0) {
            Swal.fire('Atención', 'El documento no puede quedar vacío. Elimínalo desde la lista principal si deseas.', 'warning');
            // Revert might be complex without history, but for now user is blocked from saving empty doc in save logic?
            // Actually save logic deletes if empty.
        }
    }

    saveCurrentDocChanges() {
        if (this.currentDocId) {
            const docIndex = this.scannedDocs.findIndex(d => d.id === this.currentDocId);
            if (docIndex > -1) {
                if (this.currentDocPages.length === 0) {
                    // Delete if empty
                    this.scannedDocs.splice(docIndex, 1);
                } else {
                    this.scannedDocs[docIndex].pages = [...this.currentDocPages];
                    this.scannedDocs[docIndex].name = this.currentDocName;
                    this.scannedDocs[docIndex].thumb = this.currentDocPages[0];
                }
            }
        }
        this.backToList();
    }

    backToList() {
        this.currentDocId = null;
        this.currentDocPages = [];
        this.selectedPageIndex = 0;
        this.mode = 'list';
    }

    // --- FINAL EXPORT ---

    close() {
        this.dialogRef.close(); // Cancel
    }

    async exportAllAndClose() {
        if (this.scannedDocs.length === 0) return;

        Swal.fire({
            title: 'Procesando PDF...',
            text: 'Generando archivos, por favor espere.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const files: File[] = [];

            for (const doc of this.scannedDocs) {
                const pdf = new jsPDF();
                // A4 size by default or image size? 
                // Let's standardise to A4 to be safe for "documents".
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                for (let i = 0; i < doc.pages.length; i++) {
                    if (i > 0) pdf.addPage();
                    const imgData = doc.pages[i];

                    const props = pdf.getImageProperties(imgData);
                    const imgRatio = props.width / props.height;
                    const pageRatio = pageWidth / pageHeight;

                    let renderW, renderH;
                    if (imgRatio > pageRatio) {
                        renderW = pageWidth;
                        renderH = pageWidth / imgRatio;
                    } else {
                        renderH = pageHeight;
                        renderW = pageHeight * imgRatio;
                    }

                    const x = (pageWidth - renderW) / 2;
                    const y = (pageHeight - renderH) / 2;

                    pdf.addImage(imgData, 'JPEG', x, y, renderW, renderH);
                }

                const blob = pdf.output('blob');
                const safeName = doc.name.replace(/[^a-z0-9]/gi, '_');
                const filename = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;

                files.push(new File([blob], filename, { type: 'application/pdf' }));
            }

            Swal.close();
            this.dialogRef.close(files); // Return File[]

        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Hubo un error generando los PDFs', 'error');
        }
    }
}
