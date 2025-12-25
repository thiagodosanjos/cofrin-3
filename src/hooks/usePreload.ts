/**
 * Hook para pré-carregar dados críticos em background
 * Melhora a experiência do usuário carregando dados antes de serem necessários
 */

import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

// Cache simples para evitar requests duplicados
const preloadCache = new Map<string, Promise<any>>();

/**
 * Pré-carrega uma função após interações da UI terminarem
 */
export function usePreload<T>(
  key: string,
  loadFn: () => Promise<T>,
  deps: any[] = []
): void {
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (hasPreloaded.current) return;
    
    // Aguarda interações da UI terminarem para não bloquear
    const handle = InteractionManager.runAfterInteractions(() => {
      if (preloadCache.has(key)) return;
      
      const promise = loadFn().catch(console.error);
      preloadCache.set(key, promise);
      hasPreloaded.current = true;
    });

    return () => handle.cancel();
  }, deps);
}

/**
 * Recupera dados pré-carregados do cache
 */
export function getPreloadedData<T>(key: string): Promise<T> | undefined {
  return preloadCache.get(key);
}

/**
 * Limpa o cache de preload (usar ao fazer logout)
 */
export function clearPreloadCache(): void {
  preloadCache.clear();
}
