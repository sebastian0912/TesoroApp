export interface AfiliacionesDateRange {
  start: Date;
  end: Date;
}

export interface AfiliacionesKpiSummary {
  totalIngresos: number;
  ingresosHoy: number;
  totalEmpresas: number;
  totalOficinas: number;
  totalContratados: number;
  totalPendientes: number;
}

export interface ContratacionRow {
  id: number;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  nombre_completo: string;
  empresa: string;
  oficina: string;
  finca: string;
  cargo: string;
  fecha_ingreso: string;
  estado: string;
  usuario_responsable: string;
  contratado_at: string;
  ingreso_at: string;
  examenes_medicos_at: string;
  autorizado_at: string;
  centro_costo: string;
}

export interface ResumenPorOficina {
  oficina: string;
  total: number;
  contratados: number;
  pendientes: number;
}

export interface ResumenPorEmpresa {
  empresa: string;
  total: number;
  contratados: number;
  pendientes: number;
}
