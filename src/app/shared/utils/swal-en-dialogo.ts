/**
 * Opciones para abrir un SweetAlert DESDE un MatDialog.
 *
 * Por defecto Swal se cuelga de `document.body`, que es hermano del
 * `.cdk-overlay-container` de Angular Material. Ahí el orden de pintado queda a
 * merced de los z-index y los stacking contexts, y el Swal termina detrás del
 * diálogo. Subir el z-index no siempre alcanza: el CDK declara el suyo dentro
 * de `@layer cdk-overlay`, y las capas cambian cómo se resuelve la cascada.
 *
 * La forma que no depende de nada de eso es montar el Swal DENTRO del overlay
 * (`target`): queda en el mismo contenedor que el diálogo y, como se agrega
 * después, pinta encima.
 *
 * `heightAuto: false` va de la mano: sin eso Swal le pone `height: auto` al
 * <html>, que junto con el `position: fixed` que el CDK aplica mientras hay un
 * diálogo abierto (cdk-global-scrollblock) deja el modal fuera de la pantalla.
 *
 * Uso:
 *     await Swal.fire({ ...swalEnDialogo(), title: '...', ... });
 */
export function swalEnDialogo(): { target?: HTMLElement; heightAuto: false } {
  if (typeof document === 'undefined') return { heightAuto: false };

  const overlay = document.querySelector<HTMLElement>('.cdk-overlay-container');

  // Solo se usa como target si HAY algo abierto dentro. El CDK aplica
  // `.cdk-overlay-container:empty { display: none }`, así que montar el Swal en
  // un overlay vacío (por ejemplo cuando este mismo flujo se llama desde una
  // página y no desde un diálogo) lo dejaría invisible.
  if (!overlay || overlay.childElementCount === 0) return { heightAuto: false };

  return { target: overlay, heightAuto: false };
}
