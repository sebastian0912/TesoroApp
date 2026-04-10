import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CardService, AssignedCalendarCardResponse } from '../../../core/services/card/card.service';
import { CalendarDay, CalendarTask } from '../../models/calendar.models';

@Component({
  standalone: true,
  selector: 'app-calendar-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css'
})
export class CalendarPageComponent {
  private destroyRef = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private cardService = inject(CardService);
  private router = inject(Router);

  loading = true;
  error = '';
  allTasks: CalendarTask[] = [];
  filteredTasks: CalendarTask[] = [];
  calendarDays: CalendarDay[] = [];
  calendarWorkspaces: Array<{ id: number; name: string }> = [];
  tasksByDate = new Map<string, CalendarTask[]>();
  
  currentMonth = this.startOfMonth(new Date());
  selectedDayKey = this.toDateKey(new Date());
  uiMessage = 'Este calendario muestra solo las tareas que tienes asignadas y que ya cuentan con fecha limite.';

  filtersForm = this.fb.nonNullable.group({
    query: [''],
    workspaceId: ['all'],
    priority: ['all']
  });

  constructor() {
    this.bindFilterSelectionSync();
    this.loadCalendarOverview();
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('es-CO', {
      month: 'long',
      year: 'numeric'
    }).format(this.currentMonth);
  }

  get selectedDayLabel(): string {
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date(`${this.selectedDayKey}T00:00:00`));
  }

  get selectedTasks(): CalendarTask[] {
    return this.tasksByDate.get(this.selectedDayKey) || [];
  }

  get hasActiveFilters(): boolean {
    return this.filtersForm.controls.query.value.trim().length > 0
      || this.filtersForm.controls.workspaceId.value !== 'all'
      || this.filtersForm.controls.priority.value !== 'all';
  }

  previousMonth(): void {
    this.moveMonth(-1);
    this.recalculateViewData();
  }

  nextMonth(): void {
    this.moveMonth(1);
    this.recalculateViewData();
  }

  goToToday(): void {
    const today = new Date();
    this.currentMonth = this.startOfMonth(today);
    this.selectedDayKey = this.toDateKey(today);
    this.recalculateViewData();
  }

  retryLoadCalendar(): void {
    this.error = '';
    this.loading = true;
    this.loadCalendarOverview();
  }

  clearFilters(): void {
    this.filtersForm.reset({
      query: '',
      workspaceId: 'all',
      priority: 'all'
    });
    this.uiMessage = 'Filtros limpios. Estas viendo otra vez todas tus tareas asignadas con fecha limite.';
  }

  selectDay(day: CalendarDay): void {
    this.selectedDayKey = day.key;
    const selectedDate = this.fromDateKey(day.key);

    if (!this.isSameMonth(selectedDate, this.currentMonth)) {
      this.currentMonth = this.startOfMonth(selectedDate);
      this.recalculateViewData();
    }
  }

  openBoardPreview(boardId: number): void {
    void this.router.navigate(['/dashboard/madter/board', boardId]);
  }

  trackDay(_: number, day: CalendarDay): string {
    return day.key;
  }

  trackTask(_: number, task: CalendarTask): number {
    return task.id;
  }

  priorityLabel(priority: CalendarTask['priority']): string {
    switch (priority) {
      case 'LOW':
        return 'Baja';
      case 'HIGH':
        return 'Alta';
      case 'URGENT':
        return 'Urgente';
      default:
        return 'Media';
    }
  }

  priorityTone(priority: CalendarTask['priority']): string {
    return priority.toLowerCase();
  }

  private loadCalendarOverview(): void {
    forkJoin({
      user: this.authService.me(),
      tasks: this.cardService.listAssignedCalendarMine()
    }).subscribe({
      next: ({ tasks }) => {
        this.allTasks = this.sortTasks(tasks.map(task => this.toCalendarTask(task)));
        this.focusCalendarOnFirstUsefulTask();
        this.recalculateViewData();
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        if (err?.status === 401 || err?.status === 403) {
          void this.router.navigate(['/dashboard/madter/dashboard']);
          return;
        }

        this.error = err?.error?.message ?? 'No pudimos cargar tu calendario en este momento.';
      }
    });
  }

  private toCalendarTask(task: AssignedCalendarCardResponse): CalendarTask {
    return {
      id: task.id,
      boardId: task.boardId,
      boardListId: task.boardListId,
      workspaceId: task.workspaceId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueAt: task.dueAt,
      boardName: task.boardName,
      boardListName: task.boardListName,
      workspaceName: task.workspaceName,
      accent: task.accent,
      boardAccessible: task.boardAccessible,
      searchableContent: `${task.title} ${task.boardName} ${task.boardListName} ${task.workspaceName} ${task.description ?? ''}`.toLowerCase(),
      dateKey: this.toDateKey(new Date(task.dueAt))
    };
  }

  private focusCalendarOnFirstUsefulTask(): void {
    if (!this.allTasks.length) {
      return;
    }

    const todayKey = this.toDateKey(new Date());
    const hasTasksToday = this.allTasks.some(t => t.dateKey === todayKey);
    if (hasTasksToday) {
      return;
    }

    const firstTaskDate = new Date(this.allTasks[0].dueAt);
    this.currentMonth = this.startOfMonth(firstTaskDate);
    this.selectedDayKey = this.toDateKey(firstTaskDate);
  }

  private bindFilterSelectionSync(): void {
    this.filtersForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.recalculateViewData();
        this.syncSelectionWithFilteredTasks();
      });
  }

  private syncSelectionWithFilteredTasks(): void {
    if (!this.filteredTasks.length) {
      return;
    }

    const hasTasksOnSelectedDay = this.tasksByDate.has(this.selectedDayKey);
    if (hasTasksOnSelectedDay) {
      return;
    }

    const firstVisibleTaskDate = new Date(this.filteredTasks[0].dueAt);
    this.currentMonth = this.startOfMonth(firstVisibleTaskDate);
    this.selectedDayKey = this.toDateKey(firstVisibleTaskDate);
    this.recalculateViewData();
  }

  private moveMonth(offset: number): void {
    const targetMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + offset, 1);
    this.currentMonth = targetMonth;
    this.selectedDayKey = this.pickSelectedDayForMonth(targetMonth);
  }

  private pickSelectedDayForMonth(targetMonth: Date): string {
    const monthTasks = this.filteredTasks.filter(task => {
      const dueDate = new Date(task.dueAt);
      return this.isSameMonth(dueDate, targetMonth);
    });

    if (monthTasks.length) {
      return monthTasks[0].dateKey;
    }

    const currentSelectedDate = this.fromDateKey(this.selectedDayKey);
    const lastDayOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const preservedDay = Math.min(currentSelectedDate.getDate(), lastDayOfMonth);

    return this.toDateKey(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), preservedDay));
  }

  private recalculateViewData(): void {
    // 1. Filtrar tareas base
    const query = this.filtersForm.controls.query.value.trim().toLowerCase();
    const selectedWorkspaceId = this.filtersForm.controls.workspaceId.value;
    const selectedPriority = this.filtersForm.controls.priority.value;

    this.filteredTasks = this.allTasks.filter(task => {
      if (selectedWorkspaceId !== 'all' && String(task.workspaceId) !== selectedWorkspaceId) return false;
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;
      if (query && !task.searchableContent.includes(query)) return false;
      return true;
    });

    // 2. Indexar tareas por fecha para acceso O(1)
    const newTasksByDate = new Map<string, CalendarTask[]>();
    for (const task of this.filteredTasks) {
      const list = newTasksByDate.get(task.dateKey) || [];
      list.push(task);
      newTasksByDate.set(task.dateKey, list);
    }
    this.tasksByDate = newTasksByDate;

    // 3. Reconstruir días del calendario (42 celdas estandar)
    const start = this.buildCalendarStart(this.currentMonth);
    const todayKey = this.toDateKey(new Date());
    
    this.calendarDays = Array.from({ length: 42 }, (_, index) => {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + index);
      const key = this.toDateKey(currentDate);

      return {
        key,
        label: currentDate.getDate(),
        inCurrentMonth: currentDate.getMonth() === this.currentMonth.getMonth(),
        isToday: key === todayKey,
        tasks: this.tasksByDate.get(key) || []
      };
    });

    // 4. Actualizar lista de workspaces para el filtro (solo una vez o cuando cambien las tareas base)
    const workspaceMap = new Map<number, string>();
    for (const task of this.allTasks) {
      if (!workspaceMap.has(task.workspaceId)) {
        workspaceMap.set(task.workspaceId, task.workspaceName);
      }
    }
    this.calendarWorkspaces = [...workspaceMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
  }

  private sortTasks(tasks: CalendarTask[]): CalendarTask[] {
    return [...tasks].sort((left, right) => (
      new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
    ));
  }

  private buildCalendarStart(date: Date): Date {
    const start = this.startOfMonth(date);
    const dayOfWeek = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dayOfWeek);
    return start;
  }


  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private isSameMonth(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
  }

  private fromDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
