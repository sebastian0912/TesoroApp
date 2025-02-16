// Definición de interfaces para tipar los menús
export interface ISubMenu {
  route?: string;
  action?: string;
  label: string;
  permission: string;
}

export interface IDynamicMenu {
  key: string;
  label: string;
  icon: string;
  subMenus: ISubMenu[];
}

// Configuración de los menús dinámicos
export const DYNAMIC_MENUS: IDynamicMenu[] = [
  {
    key: 'users',
    label: 'Usuarios',
    icon: 'icons/navbar/persona-de-libre-dedicacion.png',
    subMenus: [
      { route: '/dashboard/users/edit-admin', label: 'Editar administrativo', permission: 'edit-admin' },
      { route: '/dashboard/users/edit-role', label: 'Editar rol', permission: 'edit-role' },
      { route: '/dashboard/users/edit-location', label: 'Editar sede', permission: 'edit-location' },
      { route: '/dashboard/users/remove-admin', label: 'Eliminar administrativo', permission: 'remove-admin' },
      { route: '/dashboard/users/create-transfer-user', label: 'Crear usuario traslados', permission: 'create-transfer-user' },
    ],
  },
  {
    key: 'authorizations',
    label: 'Autorizaciones',
    icon: 'icons/navbar/autorizado.png',
    subMenus: [
      { route: '/dashboard/authorizations/market-bonus', label: 'Bono de mercado', permission: 'market-bonus' },
      { route: '/dashboard/authorizations/money-loan', label: 'Prestamo de dinero', permission: 'money-loan' },
    ],
  },
  {
    key: 'history',
    label: 'Historial',
    icon: 'icons/navbar/historial-medico.png',
    subMenus: [
      { route: '/dashboard/history/authorizations-history', label: 'Historial de autorizaciones', permission: 'authorizations-history' },
      { route: '/dashboard/history/modifications-history', label: 'Historial de modificaciones', permission: 'modifications-history' },
    ],
  },
  {
    key: 'market',
    label: 'Mercado',
    icon: 'icons/navbar/mercado.png',
    subMenus: [
      { route: '/dashboard/market/load-market', label: 'Cargar mercado', permission: 'load-market' },
      { route: '/dashboard/market/load-fair-market', label: 'Cargar mercado ferias', permission: 'load-fair-market' },
      { route: '/dashboard/market/marketing-market', label: 'Mercado comercializadora', permission: 'marketing-market' },
    ],
  },
  {
    key: 'money',
    label: 'Prestamo dinero',
    icon: 'icons/navbar/dar-dinero.png',
    subMenus: [
      { route: '/dashboard/money-loan/emergency-loan', label: 'Prestamo calamidad', permission: 'emergency-loan' },
      { route: '/dashboard/money-loan/loan-to-perform', label: 'Prestamo para realizar', permission: 'loan-to-perform' },
    ],
  },
  {
    key: 'merchandise',
    label: 'Mercancía',
    icon: 'icons/navbar/deposito.png',
    subMenus: [
      { route: '/dashboard/merchandise/send-merchandise', label: 'Enviar mercancia', permission: 'send-merchandise' },
      { route: '/dashboard/merchandise/edit-merchandise', label: 'Editar mercancia', permission: 'edit-merchandise' },
      { route: '/dashboard/merchandise/receive-merchandise', label: 'Recibir mercancia', permission: 'receive-merchandise' },
    ],
  },
  {
    key: 'transfers',
    label: 'Traslados',
    icon: 'icons/navbar/eps.png',
    subMenus: [
      { route: '/dashboard/eps-transfers/process-transfers', label: 'Proceso de traslados', permission: 'process-transfers' },
    ],
  },
  {
    key: 'treasury',
    label: 'Tesoreria',
    icon: 'icons/navbar/reserve.png',
    subMenus: [
      { route: '/dashboard/treasury/manage-workers', label: 'Gestionar trabajadores', permission: 'manage-workers' },
      { label: 'Añadir operarios', permission: 'add-workers', action: 'addWorkers' },
      { label: 'Extraer datos base', permission: 'extract-base-data', action: 'extractBaseData' },
      { label: 'Eliminar operarios', permission: 'delete-workers', action: 'disableWorkers' },
      { label: 'Actualizar saldos operarios', permission: 'update-workers-data', action: 'updateWorkersData' },
      { label: 'Actualizar saldos pendientes operarios', permission: 'update-pending-balances-workers', action: 'updatePendingBalancesWorkers' },
      { label: 'Resetear valores quincena', permission: 'set-values-zero', action: 'resetValues' },
      { label: 'Extraer datos tienda detalle', permission: 'extract-detailed-store-data', action: 'extractStoreData' },
      { label: 'Extraer codigos para hacer', permission: 'extract-codes-to-process', action: 'extractCodesToDo' }
    ],
  },
  {
    key: 'helps',
    label: 'Ayudas',
    icon: 'icons/navbar/subir-archivo.png',
    subMenus: [
      { label: 'Subida masiva mercados con código', permission: 'bulk-upload-markets-with-code', action: 'bulkUploadMarketsWithCode' },
      { label: 'Subida masiva mercados sin código', permission: 'bulk-upload-markets-without-code', action: 'bulkUploadMarketsWithoutCode' },
    ],
  },
];
