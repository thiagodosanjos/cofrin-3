import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    updateProfile,
} from "firebase/auth";

import { auth } from "./firebase";

export function register(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
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
