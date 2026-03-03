// tesoreria-metricas.models.ts

export interface MetricasDateRange {
    start: Date;
    end: Date;
}

export interface KpiSummary {
    saldosPendientes: number;
    transaccionesEjecutadasMonto: number;
    transaccionesEjecutadasCount: number;
    transaccionesPendientesMonto: number;
    transaccionesAutorizadasMonto: number;
}

// Para charts
export interface ChartDataPoint {
    name: string;
    value: number;
}

export interface ChartSeriesPoint {
    date: string;
    value: number;
}

export interface TopProductoChart {
    sku: string;
    nombre: string;
    cantidad: number;
    valorTotal: number;
}
