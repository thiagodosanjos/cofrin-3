import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import { auth } from "./firebase";
import { createDefaultCategories } from "./categoryService";
import { createDefaultAccount, getAllAccounts } from "./accountService";
import { useCustomAlert } from "../hooks/useCustomAlert";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth(onLogin?: () => void) {
  const { showAlert } = useCustomAlert();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: "1026415452462-bnqbtkpks7pts26n6l4eg22en1pradau.apps.googleusercontent.com",
    webClientId: "1026415452462-bnqbtkpks7pts26n6l4eg22en1pradau.apps.googleusercontent.com",
    androidClientId: "1026415452462-bnqbtkpks7pts26n6l4eg22en1pradau.apps.googleusercontent.com",
    //iosClientId: "1026415452462-3jti3vafhr81mjkrmftdv11edugdgm42.apps.googleusercontent.com",
    scopes: ["openid", "profile", "email"],
    responseType: "id_token", // <-- ESSENCIAL!
  });

  useEffect(() => {
    let mounted = true;

    if (response?.type === "success") {
      const { id_token } = response.params;

      console.log("Google Response Params:", response.params);
      
      // Manter loading ativo durante toda a autenticação
      setIsAuthenticating(true);

      const credential = GoogleAuthProvider.credential(id_token);

      signInWithCredential(auth, credential)
        .then(async (userCredential) => {
          console.log("Login Google OK!");
          
          const userId = userCredential.user.uid;
          
          // Verificar se usuário já tem contas cadastradas
          try {
            const existingAccounts = await getAllAccounts(userId);
            
            if (existingAccounts.length === 0) {
              console.log("Novo usuário Google, criando dados iniciais...");
              await Promise.all([
                createDefaultCategories(userId),
                createDefaultAccount(userId),
              ]);
              console.log("Dados iniciais criados com sucesso!");
            } else {
              console.log("Usuário já possui contas cadastradas, não criando dados duplicados.");
            }
          } catch (error) {
            console.error("Erro ao verificar/criar dados iniciais:", error);
          }
          
          if (mounted && onLogin) onLogin();
        })
        .catch((err) => {
          if (mounted) {
            console.error("Erro no login Google:", err);
            setIsAuthenticating(false);
            showAlert(
              "Erro no Login",
              `Falha ao fazer login com Google: ${err.message || err.code || "Erro desconhecido"}`,
              [{ text: "OK", style: "default" }]
            );
          }
        });
    } else if (response?.type === "cancel" || response?.type === "dismiss") {
      // Usuário cancelou o login
      setIsAuthenticating(false);
    }

    return () => {
      mounted = false;
    };
  }, [response]);

  // Wrapper do promptAsync que inicia o estado de autenticação
  const startGoogleAuth = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      const result = await promptAsync();
      // Se o usuário fechou o popup sem completar, resetar o loading
      if (result?.type !== 'success') {
        setIsAuthenticating(false);
      }
    } catch (error) {
      setIsAuthenticating(false);
      throw error;
    }
  }, [promptAsync]);

  return { request, promptAsync: startGoogleAuth, isAuthenticating };
}