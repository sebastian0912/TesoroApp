import os

base_path = r'c:\Users\sebst\Documents\GITGUB\APOYO_LABORAL\TesoroApp\src\app\features\dashboard\submodule'

html_paths = {
    'vacantes': os.path.join(base_path, 'vacancies', 'pages', 'vacantes', 'vacantes.component.html'),
    'crear-editar-vacante': os.path.join(base_path, 'vacancies', 'components', 'crear-editar-vacante', 'crear-editar-vacante.component.html'),
    'absences': os.path.join(base_path, 'hiring', 'pages', 'absences', 'absences.component.html'),
    'banned-management': os.path.join(base_path, 'hiring', 'pages', 'banned-management', 'banned-management.component.html'),
    'banned-report': os.path.join(base_path, 'hiring', 'pages', 'banned-report', 'banned-report.component.html'),
    'consult-contracting-documentation': os.path.join(base_path, 'hiring', 'pages', 'consult-contracting-documentation', 'consult-contracting-documentation.component.html'),
    'query-form': os.path.join(base_path, 'hiring', 'pages', 'query-form', 'query-form.component.html'),
    'view-reports': os.path.join(base_path, 'hiring', 'pages', 'view-reports', 'view-reports.component.html'),
    'view-reception-interviews': os.path.join(base_path, 'hiring', 'pages', 'view-reception-interviews', 'view-reception-interviews.component.html'),
    'tarjetas': os.path.join(base_path, 'hiring', 'pages', 'tarjetas', 'tarjetas.component.html'),
}

css_paths = {k: v.replace('.html', '.css') for k, v in html_paths.items() if k != 'tarjetas'}
# tarjetas is actually in submodule\tarjetas but the user path said hiring/pages/tarjetas. Oh let me see the original prompt.
# Ah, the user gave: `TesoroApp\src\app\features\dashboard\submodule\hiring\pages\tarjetas`, wait, the active document was `submodule/tarjetas/service/tarjetas.service.ts` in the previous request. but in step 5263 user said `TesoroApp\src\app\features\dashboard\submodule\hiring\pages\tarjetas`, let me check if that file exists. For now, I'll generate the CSS.

managerial_css = """

/* === MANAGERIAL PREMIUM THEME === */
.premium-card {
  border-radius: 16px !important;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02) !important;
  border: 1px solid #f1f5f9;
  background-color: #ffffff;
  overflow: hidden;
  margin-bottom: 24px;
}

.card-header-premium {
  display: flex !important;
  align-items: center !important;
  padding: 24px 32px 20px 32px !important;
  border-bottom: none !important;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%) !important;
  position: relative !important;
  overflow: hidden !important;
  border-radius: 16px !important;
  margin-bottom: 20px !important;
}

.modal-header-premium {
  padding: 24px 32px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  color: white;
  border-radius: 16px 16px 0 0;
}

.card-header-premium::before, .modal-header-premium::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(140, 213, 10, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1;
}

.header-icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 48px;
  width: 48px;
  height: 48px;
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-radius: 12px;
}

.header-icon {
  font-size: 28px;
  width: 28px;
  height: 28px;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.titulo {
  font-family: 'Inter', 'Roboto', sans-serif !important;
  font-size: 1.4rem !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  margin: 0 0 2px 0 !important;
  letter-spacing: -0.01em;
}

.subtitulo {
  font-family: 'Inter', 'Roboto', sans-serif !important;
  font-size: 0.85rem !important;
  color: #cbd5e1 !important;
  margin: 0 !important;
  font-weight: 400 !important;
}

.grow {
  flex: 1 1 auto;
}

.btn-managerial {
  background-color: #192030 !important;
  color: #8DD603 !important;
  border-radius: 8px !important;
  padding: 0 20px !important;
  height: 40px !important;
  font-weight: 600 !important;
  letter-spacing: 0.3px !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.2s ease !important;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-managerial:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.25) !important;
  background-color: #8DD603 !important;
  color: #192030 !important;
}

.btn-managerial-icon {
  background-color: transparent !important;
  color: #ffffff !important;
}
.btn-managerial-icon:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}
"""

def inject_css(p):
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'MANAGERIAL PREMIUM THEME' not in content:
            with open(p, 'a', encoding='utf-8') as f:
                f.write(managerial_css)
            print(f"Injected CSS into {os.path.basename(p)}")

for path in css_paths.values():
    inject_css(path)

# Special check for tarjetas (could be in hiring/pages/tarjetas or tarjetas/...)
tarjetas_css1 = os.path.join(base_path, 'hiring', 'pages', 'tarjetas', 'tarjetas.component.css')
tarjetas_css2 = os.path.join(base_path, 'tarjetas', 'pages', 'tarjetas', 'tarjetas.component.css')
tarjetas_html2 = os.path.join(base_path, 'tarjetas', 'pages', 'tarjetas', 'tarjetas.component.html')

if os.path.exists(tarjetas_css1):
    inject_css(tarjetas_css1)
elif os.path.exists(tarjetas_css2):
    inject_css(tarjetas_css2)
    html_paths['tarjetas'] = tarjetas_html2

def apply_html_replacement(path, old_str, new_str):
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = content.replace(old_str, new_str)
        if content != new_content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated HTML: {os.path.basename(path)}")

# 1. vacantes
apply_html_replacement(html_paths['vacantes'],
'''<mat-card>
  <mat-card-content>
    <!-- HEADER -->
    <div class="page-header">
      <h1 class="title">Listado de Vacantes</h1>
      <span class="spacer"></span>''',
'''<mat-card class="premium-card">
  <mat-card-header class="card-header-premium">
    <div class="header-content">
      <div class="header-icon-container">
        <mat-icon class="header-icon">work_outline</mat-icon>
      </div>
      <div class="header-text">
        <mat-card-title class="titulo">Listado de Vacantes</mat-card-title>
        <mat-card-subtitle class="subtitulo">Gestión y control de ofertas de empleo.</mat-card-subtitle>
      </div>
    </div>
    <span class="spacer grow" style="flex: 1 1 auto;"></span>''')

apply_html_replacement(html_paths['vacantes'],
'''      <button mat-icon-button [matMenuTriggerFor]="accionesMenu" aria-label="Acciones de vacantes">
        <mat-icon>more_vert</mat-icon>
      </button>

      <mat-menu #accionesMenu="matMenu">''',
'''      <button mat-icon-button class="btn-managerial-icon" style="z-index: 1;" [matMenuTriggerFor]="accionesMenu" aria-label="Acciones de vacantes">
        <mat-icon>more_vert</mat-icon>
      </button>

      <mat-menu #accionesMenu="matMenu">''')
apply_html_replacement(html_paths['vacantes'], 
'''<input type="file" #fileInput (change)="onFileSelected($event)" hidden />
    </div>''', 
'''<input type="file" #fileInput (change)="onFileSelected($event)" hidden />
  </mat-card-header>
  <mat-card-content class="card-content">''')
apply_html_replacement(html_paths['vacantes'], '''style="z-index: 1;" [matMenuTriggerFor]="accionesMenu"''', '''style="z-index: 1; margin-left: 16pt;" [matMenuTriggerFor]="accionesMenu"''')

# 2. crear-editar-vacante
apply_html_replacement(html_paths['crear-editar-vacante'],
'''<h1 mat-dialog-title class="titulo">Crear/Editar Vacante</h1>''',
'''<div class="modal-header-premium" style="margin: -24px -24px 24px -24px; padding: 24px;">
  <div class="header-content">
    <div class="header-icon-container">
      <mat-icon class="header-icon">add_task</mat-icon>
    </div>
    <div class="header-text">
      <h2 class="titulo" style="margin: 0 !important;">Crear/Editar Vacante</h2>
      <p class="subtitulo" style="margin: 0 !important;">Complete la información requerida para la oferta.</p>
    </div>
  </div>
</div>''')

# 3. absences
apply_html_replacement(html_paths['absences'],
'''<mat-card>
  <mat-card-content>''',
'''<mat-card class="premium-card">
  <mat-card-header class="card-header-premium">
    <div class="header-content">
      <div class="header-icon-container">
        <mat-icon class="header-icon">event_busy</mat-icon>
      </div>
      <div class="header-text">
        <mat-card-title class="titulo">Gestión de Ausentismos</mat-card-title>
        <mat-card-subtitle class="subtitulo">Carga y consulta de números para ausentismos.</mat-card-subtitle>
      </div>
    </div>
  </mat-card-header>
  <mat-card-content class="card-content">''')

# 4. banned-management
apply_html_replacement(html_paths['banned-management'],
'''<mat-card>
  <mat-card-content>
    <div class="tabla">
      <div class="header-901">
        <h1 class="title">Reporte 901 reportados</h1>''',
'''<mat-card class="premium-card">
  <mat-card-header class="card-header-premium">
    <div class="header-content">
      <div class="header-icon-container">
        <mat-icon class="header-icon">block</mat-icon>
      </div>
      <div class="header-text">
        <mat-card-title class="titulo">Gestión de Vetados 901</mat-card-title>
        <mat-card-subtitle class="subtitulo">Listado y administración de reportes 901.</mat-card-subtitle>
      </div>
    </div>
    <span class="grow"></span>''')
apply_html_replacement(html_paths['banned-management'],
'''<button mat-icon-button [matMenuTriggerFor]="menu901" matTooltip="Acciones" aria-label="Abrir acciones">
          <mat-icon>more_vert</mat-icon>
        </button>''',
'''<button mat-icon-button class="btn-managerial-icon" style="z-index: 1;" [matMenuTriggerFor]="menu901" matTooltip="Acciones" aria-label="Abrir acciones">
          <mat-icon>more_vert</mat-icon>
        </button>
  </mat-card-header>
  <mat-card-content class="card-content">
    <div class="tabla">''')

# 5. banned-report
apply_html_replacement(html_paths['banned-report'],
'''    <mat-card>
      <h1 class="title">Reporte 901</h1>
      <mat-card-content>''',
'''    <mat-card class="premium-card">
      <mat-card-header class="card-header-premium">
        <div class="header-content">
          <div class="header-icon-container">
            <mat-icon class="header-icon">report_problem</mat-icon>
          </div>
          <div class="header-text">
            <mat-card-title class="titulo">Reportar 901</mat-card-title>
            <mat-card-subtitle class="subtitulo">Generar un nuevo reporte de vetado 901.</mat-card-subtitle>
          </div>
        </div>
      </mat-card-header>
      <mat-card-content class="card-content">''')
apply_html_replacement(html_paths['banned-report'],
'''<button mat-flat-button type="submit" [disabled]="reporteForm.invalid">Enviar reporte</button>''',
'''<button mat-flat-button class="btn-managerial" type="submit" [disabled]="reporteForm.invalid">Enviar reporte</button>''')

# 6. consult-contracting-documentation (replaces page-header)
apply_html_replacement(html_paths['consult-contracting-documentation'],
'''  <!-- HEADER -->
  <header class="page-header" role="banner">
    <div class="header-content">
      <h1 class="h1-title">Consultar Documentación</h1>
      <p class="subtitle">Verifica el estado de documentos de contratación por cédula.</p>
    </div>

    <div class="header-actions">
      <button mat-icon-button [matMenuTriggerFor]="accionesMenu" aria-label="Más acciones" class="btn-more">
        <mat-icon>more_vert</mat-icon>
      </button>''',
'''  <!-- HEADER -->
  <header class="card-header-premium">
    <div class="header-content">
      <div class="header-icon-container">
        <mat-icon class="header-icon">plagiarism</mat-icon>
      </div>
      <div class="header-text">
        <h1 class="titulo" style="margin: 0 !important;">Consultar Documentación</h1>
        <p class="subtitulo" style="margin: 0 !important;">Verifica el estado de documentos de contratación por cédula.</p>
      </div>
    </div>
    <span class="grow"></span>
    <div class="header-actions" style="z-index: 1;">
      <button mat-icon-button class="btn-managerial-icon" [matMenuTriggerFor]="accionesMenu" aria-label="Más acciones" class="btn-more">
        <mat-icon>more_vert</mat-icon>
      </button>''')
apply_html_replacement(html_paths['consult-contracting-documentation'],
'''<button mat-flat-button color="primary" class="btn-consultar" (click)="buscarPorCedula()"''',
'''<button mat-flat-button class="btn-managerial btn-consultar" (click)="buscarPorCedula()"''')

# 7. query-form
apply_html_replacement(html_paths['query-form'],
'''<mat-card>
  <mat-card-content>''',
'''<mat-card class="premium-card">
  <mat-card-header class="card-header-premium">
    <div class="header-content">
      <div class="header-icon-container">
        <mat-icon class="header-icon">contact_page</mat-icon>
      </div>
      <div class="header-text">
        <mat-card-title class="titulo">Consulta de Formularios</mat-card-title>
        <mat-card-subtitle class="subtitulo">Búsqueda de registros detallados por cédula.</mat-card-subtitle>
      </div>
    </div>
  </mat-card-header>
  <mat-card-content class="card-content">''')
apply_html_replacement(html_paths['query-form'],
'''<button mat-flat-button style="margin-left: 20px; margin-right: 20px;" (click)="buscarPorCedula()">''',
'''<button mat-flat-button class="btn-managerial" style="margin-left: 20px; margin-right: 20px;" (click)="buscarPorCedula()">''')

# 8. view-reports
apply_html_replacement(html_paths['view-reports'],
'''<mat-card>
  <mat-card-content>

    <!-- HEADER GENERAL -->
    <div class="reports-header">
      <div class="header-left">
        <h1 class="title">Reportes de contratación</h1>
      </div>

      <div class="header-right">
        <button
          mat-flat-button
          (click)="descargarCedulasZip()">
          Descargar todas las cédulas por oficina
        </button>

        @if (isAdminReportUser) {
        <button
          mat-icon-button
          [matMenuTriggerFor]="menu"
          class="menu"
          matTooltip="Acciones de reportes">
          <mat-icon>more_vert</mat-icon>
        </button>
        }
      </div>
    </div>''',
'''<mat-card class="premium-card">
  <mat-card-header class="card-header-premium">
    <div class="header-content">
      <div class="header-icon-container">
        <mat-icon class="header-icon">analytics</mat-icon>
      </div>
      <div class="header-text">
        <mat-card-title class="titulo">Reportes de Contratación</mat-card-title>
        <mat-card-subtitle class="subtitulo">Visualización y exportación de reportes de personal.</mat-card-subtitle>
      </div>
    </div>
    <span class="grow"></span>
    <div class="header-right" style="z-index: 1; display: flex; align-items: center; gap: 8px;">
        <button
          mat-flat-button
          class="btn-managerial"
          (click)="descargarCedulasZip()">
          Descargar todas las cédulas por oficina
        </button>

        @if (isAdminReportUser) {
        <button
          mat-icon-button
          [matMenuTriggerFor]="menu"
          class="menu btn-managerial-icon"
          matTooltip="Acciones de reportes">
          <mat-icon>more_vert</mat-icon>
        </button>
        }
    </div>
  </mat-card-header>
  <mat-card-content class="card-content">''')

# 9. view-reception-interviews
apply_html_replacement(html_paths['view-reception-interviews'],
'''<mat-card>
  <mat-card-content>
    <div class="page">
      <div class="page-header">
        <div class="left">
          <h2 class="title">{{ title }}</h2>
          <p class="subtitle">Tabla de entrevistas registradas hoy. Descarga por
            rango en Excel.</p>
        </div>

        <div class="right">

          <button mat-flat-button color="primary"
            (click)="openRangeDialogAndExport()">
            <mat-icon>download</mat-icon>
            Descargar Excel (rango)
          </button>
        </div>
      </div>''',
'''<mat-card class="premium-card">
  <mat-card-header class="card-header-premium">
    <div class="header-content">
      <div class="header-icon-container">
        <mat-icon class="header-icon">recent_actors</mat-icon>
      </div>
      <div class="header-text">
        <mat-card-title class="titulo">{{ title }}</mat-card-title>
        <mat-card-subtitle class="subtitulo">Tabla de entrevistas registradas hoy. Descarga por rango en Excel.</mat-card-subtitle>
      </div>
    </div>
    <span class="grow"></span>
    <div class="right" style="z-index: 1;">
        <button mat-flat-button class="btn-managerial"
            (click)="openRangeDialogAndExport()">
            <mat-icon>download</mat-icon>
            Descargar Excel (rango)
        </button>
    </div>
  </mat-card-header>
  <mat-card-content class="card-content">
    <div class="page">''')

# 10. tarjetas
if not os.path.exists(html_paths['tarjetas']):
    alt_tarjetas = os.path.join(base_path, 'tarjetas', 'pages', 'tarjetas', 'tarjetas.component.html')
    if os.path.exists(alt_tarjetas):
        html_paths['tarjetas'] = alt_tarjetas

apply_html_replacement(html_paths['tarjetas'],
'''<div class="tarjetas-container">
    <!-- Header -->
    <div class="page-header">
        <div>
            <h1>Tarjetas</h1>
            <p class="subtitle">Gestión y carga masiva</p>
        </div>
        <button mat-raised-button color="primary" (click)="onCreate()">
            <mat-icon>add</mat-icon> Crear Tarjeta
        </button>
    </div>''',
'''<div class="tarjetas-container">
    <div class="card-header-premium">
        <div class="header-content">
            <div class="header-icon-container">
                <mat-icon class="header-icon">credit_card</mat-icon>
            </div>
            <div class="header-text">
                <h1 class="titulo" style="margin: 0 !important;">Tarjetas</h1>
                <p class="subtitulo" style="margin: 0 !important;">Gestión y carga masiva de tarjetas.</p>
            </div>
        </div>
        <span class="grow"></span>
        <button mat-raised-button class="btn-managerial" style="z-index: 1;" (click)="onCreate()">
            <mat-icon>add</mat-icon> Crear Tarjeta
        </button>
    </div>''')
apply_html_replacement(html_paths['tarjetas'],
'''        <mat-card-header>
            <mat-card-title>Carga Masiva</mat-card-title>
        </mat-card-header>''',
'''        <mat-card-header>
            <mat-card-title class="titulo" style="color: #192030 !important;">Carga Masiva</mat-card-title>
        </mat-card-header>''')

print("Refactoring complete.")
