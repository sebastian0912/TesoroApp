import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, take } from 'rxjs';
import { ContratacionMetricasApiService } from './contratacion-metricas-api.service';

/**
 * Servicio único para resolver cédulas → descargar Excel de candidatos.
 * Consolida los `runDownload` / `runSegmentDownload` que estaban duplicados
 * en los dos dashboards del dominio.
 */
@Injectable({ providedIn: 'root' })
export class CandidatosExcelDownloadService {
    private api = inject(ContratacionMetricasApiService);
    private snack = inject(MatSnackBar);

    public readonly downloading = signal(false);

    public run(
        docs$: Observable<string[]>,
        opts: { filenameHint: string; contextLabel: string }
    ): void {
        if (this.downloading()) return;
        this.downloading.set(true);

        docs$.pipe(take(1)).subscribe({
            next: (docs) => {
                const unique = this.normalize(docs);
                if (!unique.length) {
                    this.downloading.set(false);
                    this.snack.open(
                        `Sin candidatos para "${opts.contextLabel}".`,
                        'Cerrar',
                        { duration: 3000 }
                    );
                    return;
                }
                this.snack.open(
                    `Descargando ${unique.length} candidato(s)…`,
                    'Cerrar',
                    { duration: 2500 }
                );
                this.downloadDirect(unique, opts.filenameHint);
            },
            error: (err) => {
                this.downloading.set(false);
                console.error('[CandidatosExcelDownload] resolve docs', err);
                this.snack.open(
                    'Error al resolver los candidatos.',
                    'Cerrar',
                    { duration: 3500 }
                );
            },
        });
    }

    public runDirect(docs: string[], opts: { filenameHint: string; contextLabel?: string }): void {
        const unique = this.normalize(docs);
        if (!unique.length) {
            this.snack.open(
                opts.contextLabel
                    ? `Sin candidatos para "${opts.contextLabel}".`
                    : 'No hay candidatos para descargar.',
                'Cerrar',
                { duration: 2500 }
            );
            return;
        }
        if (this.downloading()) return;
        this.downloading.set(true);
        this.snack.open(
            `Descargando ${unique.length} candidato(s)…`,
            'Cerrar',
            { duration: 2500 }
        );
        this.downloadDirect(unique, opts.filenameHint);
    }

    private downloadDirect(docs: string[], filenameHint: string): void {
        this.api.downloadCandidatosExcel(docs, this.slug(filenameHint)).subscribe({
            next: () => {
                this.downloading.set(false);
                this.snack.open('Excel descargado.', 'Cerrar', { duration: 2000 });
            },
            error: (err) => {
                this.downloading.set(false);
                console.error('[CandidatosExcelDownload] download', err);
                this.snack.open('Error al descargar el Excel.', 'Cerrar', { duration: 3500 });
            },
        });
    }

    private normalize(docs: string[] | null | undefined): string[] {
        return Array.from(
            new Set((docs || []).map((x) => String(x ?? '').trim()).filter(Boolean))
        );
    }

    private slug(s: string): string {
        return (
            s
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .replace(/[^a-zA-Z0-9_-]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .toLowerCase() || 'candidatos'
        );
    }
}
