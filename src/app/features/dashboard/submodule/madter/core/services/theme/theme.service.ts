import { Injectable } from '@angular/core';

type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'MATDER_THEME';
  private current: Theme;

  constructor() {
    const saved = localStorage.getItem(this.storageKey) as Theme | null;
    const preferred: Theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    this.current = saved ?? preferred;
    this.apply(this.current);
  }

  get isDark(): boolean {
    return this.current === 'dark';
  }

  toggle(): void {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(this.storageKey, this.current);
    this.apply(this.current);
  }

  private apply(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
