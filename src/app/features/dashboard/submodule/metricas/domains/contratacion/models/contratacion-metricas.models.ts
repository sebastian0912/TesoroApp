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
