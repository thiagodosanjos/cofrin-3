import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../services/firebase";
import {
    subscribeToNetworkChanges,
    reconnectFirestore,
    checkNetworkConnection
} from "../utils/networkUtils";

type AuthContextProps = {
  user: User | null;
  loading: boolean;
  isOnline: boolean;
  refreshUser: () => Promise<void>;
  reconnect: () => Promise<void>;
};

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  isOnline: true,
  refreshUser: async () => {},
  reconnect: async () => {},
});

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const refreshUser = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.reload();
      setUser({ ...currentUser });
    }
  };

  // Função para reconectar manualmente
  const reconnect = useCallback(async () => {
    try {
      const connected = await checkNetworkConnection();
      setIsOnline(connected);
      
      if (connected) {
        await reconnectFirestore();
        
        // Recarrega o usuário atual se existir
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.reload();
          setUser({ ...currentUser });
        }
      }
    } catch (error) {
      console.error('Erro ao reconectar:', error);
    }
  }, []);

  useEffect(() => {
    // Listener de login automático
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    // Listener de mudanças de rede
    const unsubscribeNetwork = subscribeToNetworkChanges(
      // Quando voltar online
      async () => {
        setIsOnline(true);
        try {
          await reconnectFirestore();
          // Recarrega o estado do usuário
          const currentUser = auth.currentUser;
          if (currentUser) {
            await currentUser.reload();
            setUser({ ...currentUser });
          }
        } catch (error) {
          console.error('Erro ao reconectar após voltar online:', error);
        }
      },
      // Quando ficar offline
      () => {
        setIsOnline(false);
      }
    );

    // Verificar estado inicial da rede
    checkNetworkConnection().then(setIsOnline);

    return () => {
      unsubscribeAuth();
      unsubscribeNetwork();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isOnline, refreshUser, reconnect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
