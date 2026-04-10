import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const FAVORITE_BOARDS_STORAGE_KEY = 'MATDER_FAVORITE_BOARD_IDS';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private favoriteBoardIdsSubject = new BehaviorSubject<number[]>(this.readFavoriteBoardIds());

  favoriteBoardIds$ = this.favoriteBoardIdsSubject.asObservable();

  getSnapshot(): number[] {
    return this.favoriteBoardIdsSubject.value;
  }

  isBoardFavorite(boardId: number): boolean {
    return this.favoriteBoardIdsSubject.value.includes(boardId);
  }

  toggleBoard(boardId: number): void {
    const favorites = this.isBoardFavorite(boardId)
      ? this.favoriteBoardIdsSubject.value.filter(id => id !== boardId)
      : [...this.favoriteBoardIdsSubject.value, boardId];

    this.persistFavoriteBoardIds(favorites);
  }

  private readFavoriteBoardIds(): number[] {
    const stored = localStorage.getItem(FAVORITE_BOARDS_STORAGE_KEY);

    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value > 0);
    } catch {
      return [];
    }
  }

  private persistFavoriteBoardIds(favoriteBoardIds: number[]): void {
    localStorage.setItem(FAVORITE_BOARDS_STORAGE_KEY, JSON.stringify(favoriteBoardIds));
    this.favoriteBoardIdsSubject.next(favoriteBoardIds);
  }
}
