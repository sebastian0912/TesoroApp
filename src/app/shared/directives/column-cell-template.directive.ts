import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[appCellTemplate]',
  standalone: true,
})
export class ColumnCellTemplateDirective {
  @Input('appCellTemplate') column!: string;

  constructor(public template: TemplateRef<any>) {}
}
