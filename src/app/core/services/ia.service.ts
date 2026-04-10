import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: 'deepseek-chat' | 'deepseek-reasoner';
  temperature?: number;
  max_tokens?: number;
}

export interface SimpleAskRequest {
  prompt: string;
  system_prompt?: string;
  model?: 'deepseek-chat' | 'deepseek-reasoner';
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  id: string;
  choices: { message: ChatMessage; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface SimpleAskResponse {
  answer: string;
}

@Injectable({ providedIn: 'root' })
export class IaService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/ia`;

  /**
   * Enviar una conversacion completa (con historial) y obtener la respuesta del modelo.
   */
  chat(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat/`, request);
  }

  /**
   * Hacer una pregunta simple y obtener solo el texto de respuesta.
   */
  ask(prompt: string, systemPrompt?: string): Observable<string> {
    const body: SimpleAskRequest = { prompt };
    if (systemPrompt) body.system_prompt = systemPrompt;
    return this.http.post<SimpleAskResponse>(`${this.baseUrl}/ask/`, body).pipe(
      map(res => res.answer)
    );
  }

  /**
   * Pregunta con configuracion avanzada.
   */
  askAdvanced(request: SimpleAskRequest): Observable<string> {
    return this.http.post<SimpleAskResponse>(`${this.baseUrl}/ask/`, request).pipe(
      map(res => res.answer)
    );
  }
}
