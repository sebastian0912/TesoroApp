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
      { route: '/dashboard/users/edit-admin',      label: 'Editar administrativo',                 permission: 'edit-admin' },
      { route: '/dashboard/users/edit-role',       label: 'Editar rol',                            permission: 'edit-role' },
      { route: '/dashboard/users/edit-location',   label: 'Editar sede',                           permission: 'edit-location' },
      { route: '/dashboard/users/remove-admin',    label: 'Eliminar administrativo',               permission: 'remove-admin' },
      { route: '/dashboard/users/create-transfer-user', label: 'Crear usuario de traslados',        permission: 'create-transfer-user' },
    ],
  },

  {
    key: 'authorizations',
    label: 'Autorizaciones',
    icon: 'icons/navbar/autorizado.png',
    subMenus: [
      { route: '/dashboard/authorizations/market-bonus', label: 'Bono de mercado',    permission: 'market-bonus' },
      { route: '/dashboard/authorizations/money-loan',   label: 'Préstamo de dinero', permission: 'money-loan'   },
    ],
  },

  {
    key: 'history',
    label: 'Historial',
    icon: 'icons/navbar/historial-medico.png',
    subMenus: [
      { route: '/dashboard/history/authorizations-history', label: 'Historial de autorizaciones', permission: 'authorizations-history' },
      { route: '/dashboard/history/modifications-history',  label: 'Historial de modificaciones', permission: 'modifications-history'   },
    ],
  },

  {
    key: 'market',
    label: 'Mercado',
    icon: 'icons/navbar/mercado.png',
    subMenus: [
      { route: '/dashboard/market/load-market',        label: 'Cargar mercado',                     permission: 'load-market'        },
      { route: '/dashboard/market/load-fair-market',   label: 'Cargar mercado ferias',              permission: 'load-fair-market'   },
      { route: '/dashboard/market/marketing-market',   label: 'Mercado de comercializadora',        permission: 'marketing-market'   },
    ],
  },

  {
    key: 'money',
    label: 'Préstamo de dinero',
    icon: 'icons/navbar/dar-dinero.png',
    subMenus: [
      { route: '/dashboard/money-loan/emergency-loan', label: 'Préstamo por calamidad', permission: 'emergency-loan'   },
      { route: '/dashboard/money-loan/loan-to-perform',label: 'Préstamo para realizar', permission: 'loan-to-perform'  },
    ],
  },

  {
    key: 'merchandise',
    label: 'Mercancía',
    icon: 'icons/navbar/deposito.png',
    subMenus: [
      { route: '/dashboard/merchandise/send-merchandise',    label: 'Enviar mercancía',  permission: 'send-merchandise'    },
      { route: '/dashboard/merchandise/edit-merchandise',    label: 'Editar mercancía',  permission: 'edit-merchandise'    },
      { route: '/dashboard/merchandise/receive-merchandise', label: 'Recibir mercancía', permission: 'receive-merchandise' },
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
    label: 'Tesorería',
    icon: 'icons/navbar/reserve.png',
    subMenus: [
      { route: '/dashboard/treasury/manage-workers',      label: 'Gestionar trabajadores',                 permission: 'manage-workers'                 },
      { label: 'Añadir operarios',                        permission: 'add-workers',                       action: 'addWorkers'                        },
      { label: 'Extraer datos base',                      permission: 'extract-base-data',                 action: 'extractBaseData'                   },
      { label: 'Eliminar operarios',                      permission: 'delete-workers',                    action: 'disableWorkers'                    },
      { label: 'Actualizar saldos de operarios',          permission: 'update-workers-data',               action: 'updateWorkersData'                 },
      { label: 'Actualizar saldos pendientes de operarios', permission: 'update-pending-balances-workers', action: 'updatePendingBalancesWorkers'      },
      { label: 'Restablecer valores de quincena',         permission: 'set-values-zero',                   action: 'resetValues'                       },
      { label: 'Extraer datos tienda detalle',            permission: 'extract-detailed-store-data',       action: 'extractStoreData'                  },
      { label: 'Extraer códigos para hacer',              permission: 'extract-codes-to-process',          action: 'extractCodesToDo'                  },
    ],
  },

  {
    key: 'helps',
    label: 'Ayudas',
    icon: 'icons/navbar/subir-archivo.png',
    subMenus: [
      { label: 'Subida masiva de mercados con código',  permission: 'bulk-upload-markets-with-code',  action: 'bulkUploadMarketsWithCode'  },
      { label: 'Subida masiva de mercados sin código',  permission: 'bulk-upload-markets-without-code',action: 'bulkUploadMarketsWithoutCode'},
    ],
  },

  {
    key: 'payments',
    label: 'Pagos',
    icon: 'icons/navbar/salary.png',
    subMenus: [
      { route: '/dashboard/payments/payments-method', label: 'Formas de pago',        permission: 'payment-method' },
      { route: '/dashboard/payments/pay-slips',   label: 'Desprendibles de pago', permission: 'pay-slips'      },
    ],
  },

  // document management
  {
    key: 'document-management',
    label: 'Gestión documental',
    icon: 'icons/navbar/folders.png',
    subMenus: [
      { route: '/dashboard/document-management/search-documents',           label: 'Buscar documentación',                  permission: 'search-documents'     },
      { route: '/dashboard/document-management/upload-documents',        label: 'Adjuntar documentación',                permission: 'upload-documents'     },
      { route: '/dashboard/document-management/create-doc-structure',     label: 'Estructura documental',                 permission: 'create-doc-structure' },
      { route: '/dashboard/document-management/company-docs-access',label: 'Permisos de documentos de empresas',    permission: 'company-Docs-Access'  },
    ],
  },
  {
    key: 'hiring',
    label: 'Contratación',
    icon: 'icons/navbar/hiring.png',
    subMenus: [
      { route: '/dashboard/hiring/eps',             label: 'Ausentismos',                 permission: 'absences'             },
      { route: '/dashboard/hiring/health',          label: 'Reporte de contratación',     permission: 'hiring-report'        },
      { route: '/dashboard/hiring/transportation',  label: 'Ver reporte de contratación', permission: 'hiring‑report'        },
      { route: '/dashboard/hiring/education',       label: 'Selección',                   permission: 'recruitment-pipeline' },
      { route: '/dashboard/hiring/transportation',  label: 'Contratación',                permission: 'hiring-process'       },
      { route: '/dashboard/hiring/transportation',  label: 'Formulario de consulta',      permission: 'query-form'           },
      { route: '/dashboard/hiring/transportation',  label: 'Antecedentes robots',         permission: 'robot-background-checks' },
      { route: '/dashboard/hiring/transportation',  label: 'Reporte 901',                 permission: 'banned-report'        },
      { route: '/dashboard/hiring/transportation',  label: 'Gerencia 901',                permission: 'banned-management'    },
    ],
  },
  // disabilities
  {
    key: 'disabilities',
    label: 'Incapacidades',
    icon: 'icons/navbar/patient.png',
    subMenus: [
      { route: '/dashboard/disabilities/eps',            label: 'Formulario de incapacidad', permission: 'disability-form'         },
      { route: '/dashboard/disabilities/education',      label: 'Subida de archivos',        permission: 'upload-disability-files' },
      { route: '/dashboard/disabilities/health',         label: 'Buscar incapacidad',        permission: 'search-disabilities'     },
      { route: '/dashboard/disabilities/transportation', label: 'Incapacidades generales',   permission: 'total-disabilities'      },
    ],
  },
];

