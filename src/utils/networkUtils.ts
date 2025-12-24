import * as Network from 'expo-network';
import { db } from '../services/firebase';
import {
    enableNetwork,
    disableNetwork,
    waitForPendingWrites,
    terminate,
    clearIndexedDbPersistence
} from 'firebase/firestore';
import { Platform, AppState, AppStateStatus } from 'react-native';

/**
 * Verifica se há conexão com a internet
 */
export async function checkNetworkConnection(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch (error) {
    console.warn('Erro ao verificar conexão:', error);
    return true; // Assume conectado se não conseguir verificar
  }
}

/**
 * Força o Firestore a reconectar com o servidor
 * Útil após recuperar conexão de internet
 */
export async function reconnectFirestore(): Promise<void> {
  try {
    // Desabilita e reabilita a rede para forçar reconexão
    await disableNetwork(db);
    await enableNetwork(db);
    console.log('Firestore reconectado com sucesso');
  } catch (error) {
    console.error('Erro ao reconectar Firestore:', error);
    throw error;
  }
}

/**
 * Aguarda todas as escritas pendentes serem sincronizadas
 */
export async function waitForSync(): Promise<void> {
  try {
    await waitForPendingWrites(db);
    console.log('Todas as escritas pendentes foram sincronizadas');
  } catch (error) {
    console.error('Erro ao aguardar sincronização:', error);
  }
}

/**
 * Limpa o cache do Firestore (apenas web)
 * Para mobile, isso requer reiniciar o app
 */
export async function clearFirestoreCache(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
      console.log('Cache do Firestore limpo');
      // Nota: após limpar, o app precisa ser recarregado
    } catch (error) {
      console.error('Erro ao limpar cache do Firestore:', error);
    }
  }
}

/**
 * Verifica se um erro é relacionado a problemas de rede
 */
export function isNetworkError(error: any): boolean {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || '';
  
  const networkErrorCodes = [
    'auth/network-request-failed',
    'unavailable',
    'failed-precondition',
  ];
  
  const networkErrorMessages = [
    'network',
    'offline',
    'connection',
    'internet',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ];
  
  return (
    networkErrorCodes.some(code => errorCode.includes(code)) ||
    networkErrorMessages.some(msg => errorMessage.toLowerCase().includes(msg))
  );
}

/**
 * Tenta executar uma operação com retry automático
 * Útil para operações que podem falhar por problemas de rede
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    onRetry?: (attempt: number, error: any) => void;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    onRetry,
    shouldRetry = isNetworkError,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries && shouldRetry(error)) {
        onRetry?.(attempt, error);
        
        // Tenta reconectar o Firestore antes do próximo retry
        const isConnected = await checkNetworkConnection();
        if (isConnected) {
          try {
            await reconnectFirestore();
          } catch (reconnectError) {
            console.warn('Falha ao reconectar Firestore:', reconnectError);
          }
        }
        
        // Aguarda antes do próximo retry (com backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Listener para mudanças de conectividade
 * Usa polling com AppState já que expo-network não tem listener nativo
 */
export function subscribeToNetworkChanges(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  let wasOffline = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Função para verificar estado da rede
  const checkNetwork = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      
      if (isOnline && wasOffline) {
        // Voltou online após estar offline
        console.log('Conexão restaurada');
        onOnline();
      } else if (!isOnline && !wasOffline) {
        // Ficou offline
        console.log('Conexão perdida');
        onOffline();
      }
      
      wasOffline = !isOnline;
    } catch (error) {
      console.warn('Erro ao verificar rede:', error);
    }
  };

  // Verifica quando o app volta ao foreground
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      checkNetwork();
    }
  };

  // Inicia verificação inicial
  checkNetwork();

  // Adiciona listener de AppState
  const subscription = AppState.addEventListener('change', handleAppStateChange);

  // Polling a cada 5 segundos (apenas como fallback)
  intervalId = setInterval(checkNetwork, 5000);

  // Retorna função de cleanup
  return () => {
    subscription.remove();
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}
