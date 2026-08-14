import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

/**
 * Página "Cuenta": datos del usuario logueado + acceso a cambiar contraseña.
 * Sustituye la opción "Cambiar Contraseña" que antes vivía en el engranaje del
 * header. El cambio de contraseña en sí reutiliza la ruta ya existente.
 */
@Component({
  selector: 'app-cuenta-config',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cuenta.component.html',
  styleUrl: './cuenta.component.css',
})
export class CuentaConfigComponent implements OnInit {
  nombre = '';
  documento = '';
  rol = '';
  sede = '';
  correo = '';

  constructor(
    private readonly util: UtilityServiceService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const user: any = this.util.getUser?.();
    if (!user) return;
    this.nombre = [user?.datos_basicos?.nombres, user?.datos_basicos?.apellidos]
      .filter(Boolean)
      .join(' ');
    this.documento = user?.numero_de_documento ?? '';
    this.rol = user?.rol?.nombre ?? '';
    this.sede = user?.sede?.nombre ?? '';
    this.correo = user?.datos_basicos?.correo ?? user?.correo ?? user?.email ?? '';
  }

  get iniciales(): string {
    const parts = this.nombre.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '·';
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  cambiarContrasena(): void {
    this.router.navigate(['/dashboard/users/change-password']);
  }
}
