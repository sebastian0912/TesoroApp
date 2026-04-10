import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  WorkspaceMemberResponse,
  WorkspaceResponse,
  WorkspaceService
} from '../../../core/services/workspace/workspace.service';
import { UserLookupResponse } from '../../../core/services/user/user.service';
type WorkspaceRole = 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';

@Component({
  standalone: true,
  selector: 'app-workspace-detail-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './workspace-detail-page.component.html',
  styleUrl: './workspace-detail-page.component.css'
})
export class WorkspaceDetailPageComponent {
  private destroyRef = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private workspaceService = inject(WorkspaceService);

  loading = true;
  saving = false;
  membersLoading = false;
  workspace: WorkspaceResponse | null = null;
  members: WorkspaceMemberResponse[] = [];
  uiMessage = 'Aqui administras miembros, roles y disponibilidad del workspace.';
  error = '';
  notFound = false;
  deletingWorkspace = false;
  candidateOptions: UserLookupResponse[] = [];
  candidateLoading = false;
  selectedCandidate: UserLookupResponse | null = null;
  updatingMembershipIds = new Set<number>();
  readonly roleOptions: Array<{ value: WorkspaceRole; label: string }> = [
    { value: 'OWNER', label: 'Owner' },
    { value: 'MANAGER', label: 'Manager' },
    { value: 'MEMBER', label: 'Member' },
    { value: 'VIEWER', label: 'Viewer' }
  ];

  memberControl = new FormControl<UserLookupResponse | string | null>(null);

  addMemberForm = this.fb.nonNullable.group({
    role: this.fb.nonNullable.control<WorkspaceRole>('MEMBER', [Validators.required])
  });

  constructor() {
    this.bindCandidateSearch();
    this.loadWorkspaceContext();
  }

  get filteredMembers(): WorkspaceMemberResponse[] {
    return [...this.members].sort((left, right) => {
      if (left.role === 'OWNER' && right.role !== 'OWNER') {
        return -1;
      }
      if (left.role !== 'OWNER' && right.role === 'OWNER') {
        return 1;
      }
      return left.fullName.localeCompare(right.fullName, 'es');
    });
  }

  get canManageMembers(): boolean {
    return this.workspace?.canManageMembers ?? false;
  }

  get workspaceId(): number | null {
    return this.workspace?.id ?? null;
  }

  get addDisabled(): boolean {
    return !this.selectedCandidate || this.saving || !this.canManageMembers;
  }

  get canDeleteWorkspace(): boolean {
    return this.workspace?.canDeleteWorkspace ?? false;
  }

  goToWorkspaces(): void {
    void this.router.navigate(['/dashboard/madter/workspaces']);
  }

  goToBoards(): void {
    if (!this.workspace) {
      return;
    }

    void this.router.navigate(['/dashboard/madter/boards'], {
      queryParams: { workspaceId: this.workspace.id }
    });
  }

  retry(): void {
    this.loading = true;
    this.error = '';
    this.notFound = false;
    this.loadWorkspaceContext();
  }

  displayCandidate(value: UserLookupResponse | string | null): string {
    if (!value) {
      return '';
    }

    return typeof value === 'string' ? value : value.email;
  }

  handleCandidateSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedCandidate = event.option.value as UserLookupResponse;
  }

  clearCandidate(): void {
    this.selectedCandidate = null;
    this.candidateOptions = [];
    this.memberControl.setValue('', { emitEvent: false });
  }

  deleteWorkspace(): void {
    if (!this.workspaceId || !this.workspace || !this.canDeleteWorkspace || this.deletingWorkspace) {
      return;
    }

    if (!confirm(`Vas a eliminar el workspace "${this.workspace.name}" con sus tableros, listas y tareas. Quieres continuar?`)) {
      return;
    }

    this.deletingWorkspace = true;
    this.error = '';
    this.authService.initCsrf().pipe(
      switchMap(() => this.workspaceService.delete(this.workspaceId!))
    ).subscribe({
      next: () => {
        this.deletingWorkspace = false;
        void this.router.navigate(['/dashboard/madter/workspaces']);
      },
      error: err => {
        this.deletingWorkspace = false;
        this.error = err?.error?.message ?? 'No pudimos eliminar el workspace.';
      }
    });
  }

  addMember(): void {
    if (!this.workspaceId || !this.selectedCandidate || this.addDisabled) {
      return;
    }

    this.saving = true;
    this.error = '';

    this.authService.initCsrf().pipe(
      switchMap(() => this.workspaceService.addMember(this.workspaceId!, {
        userId: this.selectedCandidate!.id,
        role: this.addMemberForm.controls.role.value
      }))
    ).subscribe({
      next: member => {
        this.members = this.sortMembers([member, ...this.members.filter(item => item.membershipId !== member.membershipId)]);
        this.uiMessage = `${member.fullName} ahora hace parte del workspace como ${this.roleLabel(member.role)}.`;
        this.saving = false;
        this.clearCandidate();
      },
      error: err => {
        this.saving = false;
        this.error = err?.error?.message ?? 'No pudimos agregar el miembro al workspace.';
      }
    });
  }

  updateMemberRole(member: WorkspaceMemberResponse, role: WorkspaceRole): void {
    if (!this.workspaceId || !this.canManageMembers || member.role === role) {
      return;
    }

    this.updatingMembershipIds.add(member.membershipId);
    this.authService.initCsrf().pipe(
      switchMap(() => this.workspaceService.updateMember(this.workspaceId!, member.membershipId, {
        role,
        active: member.active
      }))
    ).subscribe({
      next: updatedMember => {
        this.members = this.sortMembers(this.members.map(item => (
          item.membershipId === updatedMember.membershipId ? updatedMember : item
        )));
        this.uiMessage = `${updatedMember.fullName} ahora tiene el rol ${this.roleLabel(updatedMember.role)}.`;
        this.updatingMembershipIds.delete(member.membershipId);
      },
      error: err => {
        this.updatingMembershipIds.delete(member.membershipId);
        this.error = err?.error?.message ?? 'No pudimos actualizar el rol del miembro.';
      }
    });
  }

  toggleMemberActive(member: WorkspaceMemberResponse): void {
    if (!this.workspaceId || !this.canManageMembers || member.owner) {
      return;
    }

    this.updatingMembershipIds.add(member.membershipId);
    this.authService.initCsrf().pipe(
      switchMap(() => this.workspaceService.updateMember(this.workspaceId!, member.membershipId, {
        role: member.role,
        active: !member.active
      }))
    ).subscribe({
      next: updatedMember => {
        this.members = this.sortMembers(this.members.map(item => (
          item.membershipId === updatedMember.membershipId ? updatedMember : item
        )));
        this.uiMessage = updatedMember.active
          ? `${updatedMember.fullName} volvio a quedar activo dentro del workspace.`
          : `${updatedMember.fullName} quedo fuera del workspace por ahora.`;
        this.updatingMembershipIds.delete(member.membershipId);
      },
      error: err => {
        this.updatingMembershipIds.delete(member.membershipId);
        this.error = err?.error?.message ?? 'No pudimos actualizar el estado del miembro.';
      }
    });
  }

  roleLabel(role: WorkspaceRole): string {
    return this.roleOptions.find(option => option.value === role)?.label ?? role;
  }

  memberStatusLabel(member: WorkspaceMemberResponse): string {
    if (!member.active) {
      return 'Fuera del workspace';
    }
    if (member.assignable) {
      return 'Listo para tareas';
    }
    return 'Sin asignacion operativa';
  }

  isUpdating(memberId: number): boolean {
    return this.updatingMembershipIds.has(memberId);
  }

  private loadWorkspaceContext(): void {
    const workspaceId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    forkJoin({
      csrf: this.authService.initCsrf(),
      workspace: this.workspaceService.getById(workspaceId),
      members: this.workspaceService.listMembers(workspaceId)
    }).subscribe({
      next: ({ workspace, members }) => {
        this.workspace = workspace;
        this.members = this.sortMembers(members);
        this.loading = false;
      },
      error: err => {
        if (err?.status === 404) {
          this.notFound = true;
          this.loading = false;
          return;
        }

        if (err?.status === 401 || err?.status === 403) {
          void this.router.navigate(['/dashboard/madter/dashboard']);
          return;
        }

        this.error = err?.error?.message ?? 'No pudimos cargar este workspace.';
        this.loading = false;
      }
    });
  }

  private bindCandidateSearch(): void {
    this.memberControl.valueChanges
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        switchMap(value => {
          if (!this.workspaceId || !this.canManageMembers) {
            this.candidateOptions = [];
            return of([] as UserLookupResponse[]);
          }

          if (typeof value !== 'string') {
            return of([] as UserLookupResponse[]);
          }

          const query = value.trim();
          if (this.selectedCandidate && query !== this.selectedCandidate.email) {
            this.selectedCandidate = null;
          }

          if (query.length < 2) {
            this.candidateOptions = [];
            this.candidateLoading = false;
            return of([] as UserLookupResponse[]);
          }

          this.candidateLoading = true;
          return this.workspaceService.searchMemberCandidates(this.workspaceId, query).pipe(
            finalize(() => {
              this.candidateLoading = false;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(options => {
        this.candidateOptions = options;
      });
  }

  private sortMembers(members: WorkspaceMemberResponse[]): WorkspaceMemberResponse[] {
    return [...members].sort((left, right) => {
      if (left.role === 'OWNER' && right.role !== 'OWNER') {
        return -1;
      }
      if (left.role !== 'OWNER' && right.role === 'OWNER') {
        return 1;
      }
      return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
    });
  }
}
