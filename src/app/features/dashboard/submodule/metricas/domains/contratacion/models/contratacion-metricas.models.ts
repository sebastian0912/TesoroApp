// contratacion-metricas.models.ts

export interface MetricasContratacionDateRange {
    start: Date;
    end: Date;
}

export interface ContratacionKpiSummary {
    totalLlenaronFormulario: number;
    totalConEmail: number;
    totalConCelular: number;
    totalCandidatos: number; // base
}

export interface ChartDataPoint {
    name: string;
    value: number;
}

export interface ChartSeriesPoint {
    name: string;
    type: string;
    data: number[];
    itemStyle?: any;
    label?: any;
    stack?: string;
}

export interface CandidatoSinCelular {
    id: number;
    nombres: string;
    apellidos: string;
    numero_documento: string;
    oficina: string;
}

export interface EmpresaFincaPivot {
    empresa: string;
    finca: string;
    count: number;
}

// View-model del pipeline (series + eje X en un solo stream — sin hacks `as any`).
export interface PipelineVM {
    series: ChartSeriesPoint[];
    xAxis: string[];
}

// Etapas del pipeline aceptadas por el backend (procesos/metricas-temporal-docs/).
export type PipelineStage =
    | 'entrevistado'
    | 'prueba_o_auto'
    | 'examenes'
    | 'contratado'
    | 'ingreso'
    | 'rechazado';

/**
 * Etiqueta visible en la UI (name de la serie de ECharts o del stacked bar)
 * a la clave de stage que espera el backend. Centralizado aquí para que el
 * frontend y el backend no se desincronicen cuando se renombren labels.
 */
export const STAGE_LABEL_TO_KEY: Record<string, PipelineStage> = {
    'Entrevistado': 'entrevistado',
    'Prueba/Autorizado': 'prueba_o_auto',
    'Prueba o Autorizado': 'prueba_o_auto',
    'Exámenes': 'examenes',
    'Examenes Med': 'examenes',
    'Contratado': 'contratado',
    'Ingreso': 'ingreso',
    'No Aplica (911)': 'rechazado',
    'Rechazado': 'rechazado',
};
