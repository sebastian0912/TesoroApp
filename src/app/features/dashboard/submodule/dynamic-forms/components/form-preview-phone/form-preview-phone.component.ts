import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FieldRendererComponent } from '@/app/shared/components/forms/field-renderer/field-renderer.component';
import { DynamicField, FieldValue, FormSection } from '../../models/dynamic-forms.models';

/** Sección lista para pintar: todos los campos con `name` garantizado. */
interface SeccionPreview {
  titulo: string | null;
  campos: DynamicField[];
}

/**
 * Vista previa "teléfono" del builder: pinta EN VIVO el formulario tal como lo
 * verá quien lo llene, derivada 100% del estado de la página (input sections);
 * no mantiene una copia editable de la estructura.
 *
 * Los VALORES sí son estado local efímero (probar los controles no toca nada):
 * como en modo creación los campos aún no tienen `name` (lo genera el backend),
 * se sintetiza un name posicional SOLO para esta vista — jamás viaja al API.
 */
@Component({
  selector: 'app-form-preview-phone',
  standalone: true,
  imports: [CommonModule, FieldRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="phone" role="region" aria-label="Vista previa del formulario">
      <div class="phone__top"><span class="phone__notch"></span></div>
      <div class="phone__screen">
        <div class="phone__header">
          <h3 class="phone__name">{{ formName() || 'Formulario sin nombre' }}</h3>
          @if (formDescription()) {
            <p class="phone__desc">{{ formDescription() }}</p>
          }
        </div>

        @if (totalCampos() === 0) {
          <div class="phone__empty">
            <span class="material-symbols-outlined" aria-hidden="true">smartphone</span>
            <p>Agrega campos para ver la vista previa en vivo.</p>
          </div>
        } @else {
          @for (sec of vista(); track $index) {
            @if (sec.campos.length > 0) {
              <section class="phone__section">
                @if (sec.titulo) { <h4 class="phone__section-title">{{ sec.titulo }}</h4> }
                <!-- Una sola columna: el teléfono simula el ancho móvil real. -->
                <div class="phone__fields">
                  @for (f of sec.campos; track f.name) {
                    <app-field-renderer
                        [field]="f"
                        mode="preview"
                        [value]="valor(f)"
                        [sectionValues]="valores()"
                        (valueChange)="poner(f, $event)"
                        (childChange)="poner($event.field, $event.value)" />
                  }
                </div>
              </section>
            }
          }
        }
      </div>
      <div class="phone__foot">
        <span class="phone__foot-hint">Vista previa · los valores no se guardan</span>
        @if (hayValores()) {
          <button type="button" class="phone__reset" (click)="limpiar()" title="Limpiar los valores de prueba">
            <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span> Limpiar
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .phone {
      width: 380px;
      max-width: 100%;
      margin: 0 auto;
      border: 10px solid var(--navy-deep, #0f172a);
      border-radius: 42px;
      background: var(--surface, #fff);
      box-shadow: var(--shadow-md, 0 10px 26px rgba(17,24,39,.10));
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .phone__top {
      background: var(--navy-deep, #0f172a);
      display: flex;
      justify-content: center;
      padding-bottom: 6px;
    }
    .phone__notch {
      width: 110px;
      height: 16px;
      background: #000;
      border-radius: 0 0 12px 12px;
    }
    .phone__screen {
      height: 600px;
      overflow-y: auto;
      background: var(--slate-50, #f8fafc);
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 0 12px 20px;
    }
    .phone__header {
      background: var(--navy, #21263c);
      color: #fff;
      margin: 0 -12px;
      padding: 14px 16px 16px;
    }
    .phone__name {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 700;
      word-break: break-word;
    }
    .phone__desc {
      margin: 4px 0 0;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.75);
      word-break: break-word;
    }
    .phone__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 90px;
      color: var(--slate-500, #64748b);
      text-align: center;
      padding: 0 20px;
    }
    .phone__empty .material-symbols-outlined { font-size: 44px; }
    .phone__empty p { margin: 0; font-size: 0.88rem; }
    .phone__section {
      background: var(--surface, #fff);
      border: 1px solid var(--slate-200, #e8edf3);
      border-radius: var(--r-md, 14px);
      padding: 12px;
    }
    .phone__section-title {
      margin: 0 0 10px;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--navy, #21263c);
      border-bottom: 2px solid var(--lime, #8cd50a);
      padding-bottom: 4px;
    }
    .phone__fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .phone__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: var(--navy-deep, #0f172a);
      padding: 8px 14px;
    }
    .phone__foot-hint {
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.6);
    }
    .phone__reset {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font: inherit;
      font-size: 0.75rem;
      padding: 4px 10px;
      cursor: pointer;
    }
    .phone__reset:hover { background: rgba(255, 255, 255, 0.22); }
    .phone__reset:focus-visible { outline: 2px solid var(--lime, #8cd50a); outline-offset: 1px; }
    .phone__reset .material-symbols-outlined { font-size: 15px; }
  `],
})
export class FormPreviewPhoneComponent {
  formName = input<string>('');
  formDescription = input<string>('');
  /** ÚNICA fuente de la estructura: las secciones del builder tal cual. */
  sections = input<FormSection[]>([]);

  /** Valores efímeros de prueba, por name (real o sintetizado). */
  private valoresMap = signal<Record<string, FieldValue>>({});
  valores = this.valoresMap.asReadonly();

  /** Estructura derivada con `name` garantizado en cada campo e hijo. */
  vista = computed<SeccionPreview[]>(() =>
    this.sections().map((s, si) => ({
      titulo: s.title?.trim() || null,
      campos: s.fields.map((f, fi) => this.conNombre(f, `pv_s${si}_f${fi}`)),
    })),
  );

  totalCampos = computed(() =>
    this.sections().reduce((acc, s) => acc + s.fields.length, 0));

  hayValores = computed(() => Object.keys(this.valoresMap()).length > 0);

  valor(f: DynamicField): FieldValue {
    const n = f.name;
    return n ? (this.valoresMap()[n] ?? null) : null;
  }

  poner(f: DynamicField, v: FieldValue): void {
    const n = f.name;
    if (!n) return;
    this.valoresMap.update(m => ({ ...m, [n]: v }));
  }

  limpiar(): void {
    this.valoresMap.set({});
  }

  /** Copia del campo con name sintético posicional (solo para el preview). */
  private conNombre(f: DynamicField, uid: string): DynamicField {
    const hijos = f.children?.map((c, ci) => ({ ...c, name: c.name ?? `${uid}_c${ci}` }));
    return hijos
      ? { ...f, name: f.name ?? uid, children: hijos }
      : { ...f, name: f.name ?? uid };
  }
}
