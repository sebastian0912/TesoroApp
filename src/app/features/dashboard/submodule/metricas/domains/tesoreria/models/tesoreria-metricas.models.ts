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

// --- Nuevas interfaces para metricas-resumen ---

export interface HistorialItem {
    numero_documento: string;
    nombre: string;
    finca: string;
    fecha_ejecucion: string;
    fecha_autorizacion: string;
    concepto: string;
    monto: number;
    estado: string;
    autorizado_por: string;
    ejecutado_por: string;
    quien_entrego: string;
    productos: { producto: string; cantidad: number; valor_unitario: number }[];
}

export interface TopComprador {
    numero_documento: string;
    nombre: string;
    finca: string;
    total_transacciones: number;
    monto_total: number;
}

export interface RankingAutorizador {
    autorizado_por: string;
    total_autorizaciones: number;
    monto_total: number;
}

export interface ProductoFecha {
    fecha: string;
    producto: string;
    cantidad: number;
}

export interface MetricasResumen {
    historial: HistorialItem[];
    top_compradores: TopComprador[];
    ranking_autorizadores: RankingAutorizador[];
    productos_por_fecha: ProductoFecha[];
}
