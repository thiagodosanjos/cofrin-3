import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    updateProfile,
} from "firebase/auth";

import { auth } from "./firebase";
import { createDefaultCategories } from "./categoryService";
import { createDefaultAccount } from "./accountService";
import { withRetry, reconnectFirestore, checkNetworkConnection } from "../utils/networkUtils";

export async function register(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;
  
  // Criar categorias e conta padrão para o novo usuário
  try {
    await Promise.all([
      createDefaultCategories(userId),
      createDefaultAccount(userId),
    ]);
    console.log("Conta padrão e categorias criadas com sucesso para:", userId);
  } catch (error) {
    console.error("Erro ao criar dados iniciais para novo usuário:", error);
    // Mesmo com erro, continuamos o registro
  }
  
  return userCredential;
}

export async function login(email: string, password: string) {
  // Verifica conexão e tenta reconectar antes de fazer login
  const isConnected = await checkNetworkConnection();
  
  if (!isConnected) {
    throw { code: 'auth/network-request-failed', message: 'Sem conexão com a internet' };
  }
  
  // Tenta reconectar o Firestore antes do login para garantir estado limpo
  try {
    await reconnectFirestore();
  } catch (e) {
    // Ignora erros de reconexão, tenta login mesmo assim
    console.warn('Aviso: não foi possível reconectar Firestore antes do login');
  }
  
  // Usa retry para lidar com problemas temporários de rede
  return withRetry(
    () => signInWithEmailAndPassword(auth, email, password),
    {
      maxRetries: 2,
      delayMs: 1000,
      onRetry: (attempt, error) => {
        console.log(`Tentativa ${attempt} de login falhou, tentando novamente...`, error?.code);
      },
    }
  );
}

export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  return signOut(auth);
}

export async function updateUserProfile(displayName: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  
  await updateProfile(user, { displayName });
  
  // Forçar reload para atualizar o displayName no contexto
  await user.reload();
}
