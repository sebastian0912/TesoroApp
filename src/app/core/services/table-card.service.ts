import { Injectable, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Transforma automáticamente TODAS las mat-tables en VCards en mobile.
 *
 * Cómo funciona:
 *  1. Observa el DOM con MutationObserver.
 *  2. Cuando detecta una tabla (.mat-mdc-table), lee los encabezados <th>
 *     y les asigna data-label a cada <td> de la misma columna.
 *  3. El CSS global de styles.css usa attr(data-label) para mostrar el
 *     nombre de la columna antes de cada celda en mobile.
 *
 * Opt-out: añadir atributo data-no-vcard a la tabla o su contenedor.
 */
@Injectable({ providedIn: 'root' })
export class TableCardService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Llamar una vez desde AppComponent.ngOnInit() */
  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.labelAllTables();

    this.observer = new MutationObserver((mutations) => {
      const hasTableMutation = mutations.some(m =>
        Array.from(m.addedNodes).some(n =>
          n.nodeType === Node.ELEMENT_NODE &&
          ((n as Element).matches?.('table,tr,td,th') ||
           (n as Element).querySelector?.('table,tr,td,th'))
        )
      );
      if (!hasTableMutation) return;

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.labelAllTables(), 80);
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private labelAllTables(): void {
    const tables = document.querySelectorAll<HTMLTableElement>(
      'table.mat-mdc-table:not([data-no-vcard]):not([data-vcard-labeled])'
    );

    tables.forEach(table => {
      if (table.closest('[data-no-vcard]')) return;

      const headers = Array.from(table.querySelectorAll<HTMLElement>('thead th'))
        .map(th => {
          // Ignora mat-icons y text-only icons dentro del header
          const clone = th.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('mat-icon,.mat-icon').forEach(el => el.remove());
          return clone.textContent?.trim() ?? '';
        });

      if (!headers.length) return;

      const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
      rows.forEach(row => {
        if (row.querySelector('td[colspan]')) return; // skip empty-state rows

        const cells = row.querySelectorAll<HTMLTableCellElement>('td');
        cells.forEach((cell, i) => {
          const label = headers[i] ?? '';
          cell.setAttribute('data-label', label);
        });
      });

      // Marca la tabla como ya procesada para la sesión actual
      // (se re-procesa cuando haya nuevas filas, no en cada mutation)
      table.setAttribute('data-vcard-labeled', '1');
    });

    // Re-etiquetar tablas con nuevas filas (data-vcard-labeled ya existe pero
    // pueden haber llegado filas nuevas sin data-label)
    const labeledTables = document.querySelectorAll<HTMLTableElement>(
      'table.mat-mdc-table[data-vcard-labeled]:not([data-no-vcard])'
    );

    labeledTables.forEach(table => {
      const headers = Array.from(table.querySelectorAll<HTMLElement>('thead th'))
        .map(th => {
          const clone = th.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('mat-icon,.mat-icon').forEach(el => el.remove());
          return clone.textContent?.trim() ?? '';
        });

      if (!headers.length) return;

      const unlabeled = table.querySelectorAll<HTMLTableCellElement>('tbody tr:not([data-labeled]) td');
      if (!unlabeled.length) return;

      const rows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
      rows.forEach(row => {
        if (row.dataset['labeled']) return;
        if (row.querySelector('td[colspan]')) return;

        const cells = row.querySelectorAll<HTMLTableCellElement>('td');
        cells.forEach((cell, i) => {
          cell.setAttribute('data-label', headers[i] ?? '');
        });
        row.setAttribute('data-labeled', '1');
      });
    });
  }
}
