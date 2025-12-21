import { useState, useCallback, useRef } from 'react';

interface OperationProgress {
  current: number;
  total: number;
}

interface AsyncOperationState {
  loading: boolean;
  message: string;
  progress: OperationProgress | null;
}

interface AsyncOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Hook para gerenciar operações assíncronas com feedback visual sincronizado.
 * 
 * Garante que:
 * 1. O loading é mostrado durante TODA a operação (incluindo refreshes)
 * 2. O feedback só aparece DEPOIS que tudo terminou
 * 3. O usuário não pode interagir durante operações críticas
 * 
 * @example
 * ```tsx
 * const { state, execute, updateProgress } = useAsyncOperation();
 * 
 * const handleSave = async () => {
 *   const result = await execute(
 *     async (updateProgress) => {
 *       // Operação longa
 *       for (let i = 0; i < items.length; i++) {
 *         updateProgress(i + 1, items.length);
 *         await processItem(items[i]);
 *       }
 *       return { success: true };
 *     },
 *     'Salvando...'
 *   );
 *   
 *   if (result.success) {
 *     showSnackbar('Salvo com sucesso!');
 *   }
 * };
 * ```
 */
export function useAsyncOperation() {
  const [state, setState] = useState<AsyncOperationState>({
    loading: false,
    message: '',
    progress: null,
  });

  // Ref para evitar updates em componentes desmontados
  const isMountedRef = useRef(true);

  const updateProgress = useCallback((current: number, total: number) => {
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        progress: { current, total },
      }));
    }
  }, []);

  const setMessage = useCallback((message: string) => {
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        message,
      }));
    }
  }, []);

  const execute = useCallback(async <T>(
    operation: (
      updateProgress: (current: number, total: number) => void,
      setMessage: (message: string) => void
    ) => Promise<AsyncOperationResult<T>>,
    initialMessage: string = 'Processando...'
  ): Promise<AsyncOperationResult<T>> => {
    try {
      setState({
        loading: true,
        message: initialMessage,
        progress: null,
      });

      const result = await operation(updateProgress, setMessage);

      return result;
    } catch (error: any) {
      console.error('AsyncOperation error:', error);
      return {
        success: false,
        error: error.message || 'Ocorreu um erro inesperado',
      };
    } finally {
      if (isMountedRef.current) {
        setState({
          loading: false,
          message: '',
          progress: null,
        });
      }
    }
  }, [updateProgress, setMessage]);

  /**
   * Executa múltiplas operações em lote com paralelização controlada.
   * Divide o array em chunks e processa cada chunk em paralelo.
   * 
   * @param items Array de itens para processar
   * @param processor Função que processa cada item
   * @param options Opções de concorrência e mensagens
   */
  const executeBatch = useCallback(async <T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: {
      message?: string;
      concurrency?: number; // Quantos processar em paralelo (default: 5)
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<{ results: R[]; errors: Array<{ index: number; error: any }> }> => {
    const { message = 'Processando...', concurrency = 5 } = options;
    const total = items.length;
    const results: R[] = [];
    const errors: Array<{ index: number; error: any }> = [];

    setState({
      loading: true,
      message,
      progress: { current: 0, total },
    });

    try {
      // Processar em chunks para paralelização controlada
      for (let i = 0; i < total; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);
        const chunkPromises = chunk.map(async (item, chunkIndex) => {
          const globalIndex = i + chunkIndex;
          try {
            const result = await processor(item, globalIndex);
            return { success: true, result, index: globalIndex };
          } catch (error) {
            return { success: false, error, index: globalIndex };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        
        for (const res of chunkResults) {
          if (res.success) {
            results[res.index] = res.result as R;
          } else {
            errors.push({ index: res.index, error: res.error });
          }
        }

        // Atualizar progresso
        const completed = Math.min(i + concurrency, total);
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            progress: { current: completed, total },
          }));
        }
        options.onProgress?.(completed, total);
      }

      return { results, errors };
    } finally {
      if (isMountedRef.current) {
        setState({
          loading: false,
          message: '',
          progress: null,
        });
      }
    }
  }, []);

  return {
    state,
    execute,
    executeBatch,
    updateProgress,
    setMessage,
    isLoading: state.loading,
  };
}

/**
 * Utilitário para criar chunks de um array
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Executa promessas em paralelo com limite de concorrência
 * Útil para operações em lote no Firebase
 */
export async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<{ results: R[]; errors: Array<{ index: number; error: any }> }> {
  const results: R[] = [];
  const errors: Array<{ index: number; error: any }> = [];
  const total = items.length;
  let completed = 0;

  const chunks = chunkArray(items, limit);

  for (const chunk of chunks) {
    const startIndex = chunks.indexOf(chunk) * limit;
    const promises = chunk.map(async (item, i) => {
      const globalIndex = startIndex + i;
      try {
        const result = await fn(item, globalIndex);
        results[globalIndex] = result;
        return { success: true };
      } catch (error) {
        errors.push({ index: globalIndex, error });
        return { success: false };
      }
    });

    await Promise.all(promises);
    completed += chunk.length;
    onProgress?.(completed, total);
  }

  return { results, errors };
}
