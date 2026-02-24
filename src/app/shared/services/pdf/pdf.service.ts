import { Injectable } from '@angular/core';
import { PDFDocument } from 'pdf-lib';

@Injectable({
    providedIn: 'root'
})
export class PdfService {

    constructor() { }

    /**
     * Une múltiples archivos PDF en uno solo.
     * @param files Lista de archivos (File) a unir.
     * @param filenameNombre Nombre del archivo resultante.
     * @param onProgress Callback opcional para reportar el progreso (índice actual, total).
     * @returns Promesa con el archivo (File) fusionado.
     */
    async mergePdfs(
        files: File[],
        filename: string,
        onProgress?: (current: number, total: number) => void
    ): Promise<File> {
        const pdfDoc = await PDFDocument.create();
        const total = files.length;

        // Leer buffers en paralelo
        const buffers = await Promise.all(files.map(f => f.arrayBuffer()));

        for (let i = 0; i < total; i++) {
            try {
                const src = await PDFDocument.load(buffers[i], { updateMetadata: false });
                const copiedPages = await pdfDoc.copyPages(src, src.getPageIndices());
                copiedPages.forEach(p => pdfDoc.addPage(p));
            } catch (error) {
                console.error(`Error al procesar el archivo ${files[i].name}`, error);
                // Podríamos decidir si fallar todo o continuar con los válidos.
                // Por ahora, solo logueamos y continuamos la fusión.
            }

            if (onProgress) {
                onProgress(i + 1, total);
            }

            // Ceder control al event loop para no congelar la UI en procesos pesados
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const bytes = await pdfDoc.save({ addDefaultPage: false });

        // Crear Uint8Array y luego File
        const ab = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(ab).set(bytes);

        return new File([ab], filename, { type: 'application/pdf' });
    }

    /**
     * Verifica si un archivo es PDF por su tipo MIME o extensión.
     */
    isPdf(file?: File | null): boolean {
        return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    }
}
