import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '@/environments/environment';

/**
 * Plan que el server 1 publica en /migration/plan/.
 * Lo único que necesitamos del catalogs es el blob completo: lo guardamos
 * tal cual junto a los lotes para que el server 2 lo consuma después.
 */
export interface MigrationOwnerStats {
  owner_id: string;
  documents: number;
  versions: number;
  bytes: number;
}

export interface MigrationSuggestedBatch {
  batch_id: string;
  owner_ids: string[];
  versions: number;
  bytes: number;
}

export interface MigrationPlan {
  schema_version: number;
  generated_at: string;
  source_media_root: string;
  totals: {
    documents: number;
    versions: number;
    bytes: number;
    owners: number;
    suggested_batches: number;
  };
  owners: MigrationOwnerStats[];
  catalogs: any;
  suggested_batches: MigrationSuggestedBatch[];
}

/**
 * Resultado de descargar un lote.
 * `headers` viene del backend con los counts reales para que el cliente
 * pueda validar coherencia (ej: si X-Files-Missing > 0, hay que revisar).
 */
export interface MigrationBatchDownload {
  batch_id: string;
  blob: Blob;
  filename: string;
  headers: {
    documents: number;
    versions: number;
    filesWritten: number;
    filesMissing: number;
  };
}

@Injectable({ providedIn: 'root' })
export class MigrationService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  /**
   * GET plan completo. El AuthInterceptor agrega Authorization: Bearer
   * automaticamente; el backend valida JWT + rol (ADMIN/GERENCIA).
   *
   * @param ownersPerBatch tamaño máximo de cada lote sugerido (default 50)
   * @param maxBatchBytes  cap por lote en bytes (default 300MB)
   */
  async getPlan(
    ownersPerBatch?: number,
    maxBatchBytes?: number,
  ): Promise<MigrationPlan> {
    const params: Record<string, string> = {};
    if (ownersPerBatch) params['owners_per_batch'] = String(ownersPerBatch);
    if (maxBatchBytes) params['max_batch_bytes'] = String(maxBatchBytes);

    return await firstValueFrom(
      this.http.get<MigrationPlan>(`${this.base}/gestion_documental/migration/plan/`, {
        headers: this.baseHeaders(),
        params,
      }),
    );
  }

  /**
   * GET lote: ZIP streaming con manifest.json + files/<rel>.
   * Usamos `observe: 'response'` para poder leer X-* headers.
   */
  async downloadBatch(
    batch: MigrationSuggestedBatch,
    opts?: { includeChunks?: boolean; includeAccessLogs?: boolean; timeoutMs?: number },
  ): Promise<MigrationBatchDownload> {
    const params: Record<string, string> = {
      owner_ids: batch.owner_ids.join(','),
      batch_id: batch.batch_id,
    };
    if (opts?.includeChunks) params['include_chunks'] = '1';
    if (opts?.includeAccessLogs) params['include_access_logs'] = '1';

    const resp: HttpResponse<Blob> = await firstValueFrom(
      this.http.get(`${this.base}/gestion_documental/migration/export/`, {
        headers: this.baseHeaders(),
        params,
        responseType: 'blob',
        observe: 'response',
      }),
    );

    if (!resp.body) {
      throw new Error(`Lote ${batch.batch_id} vino sin body`);
    }

    return {
      batch_id: batch.batch_id,
      blob: resp.body,
      filename: `${batch.batch_id}.zip`,
      headers: {
        documents: Number(resp.headers.get('X-Documents') ?? '0'),
        versions: Number(resp.headers.get('X-Versions') ?? '0'),
        filesWritten: Number(resp.headers.get('X-Files-Written') ?? '0'),
        filesMissing: Number(resp.headers.get('X-Files-Missing') ?? '0'),
      },
    };
  }

  private baseHeaders(): HttpHeaders {
    // No mandamos Authorization aqui: el AuthInterceptor (core) lo agrega
    // automaticamente. Solo pedimos */* para que DRF no haga 406 con un
    // Accept estrecho cuando la respuesta es binaria (zip).
    return new HttpHeaders({
      'Accept': '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    });
  }
}
