import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Login from "../screens/Login";
import Register from "../screens/Register";
import Home from "../screens/Home";
import Settings from "../screens/Settings";
import { useAuth } from "../contexts/authContext";
import Launches from "../screens/Launches";
import Reports from "../screens/Reports";

const Stack = createNativeStackNavigator();

export default function RootNavigation() {
  const { user, loading } = useAuth();

  if (loading) {
    // Tela de loading durante verificação
    return null;
  }

  return (
    <NavigationContainer>
      {user ? (
        // ROTAS DO USUÁRIO LOGADO
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Bem-vindo" component={Home} />
          <Stack.Screen name="Lançamentos" component={Launches} />
          <Stack.Screen name="Relatórios" component={Reports} />
          <Stack.Screen name="Configurações" component={Settings} />
        </Stack.Navigator>
      ) : (
        // ROTAS PÚBLICAS
        <Stack.Navigator>
          <Stack.Screen name="Faça login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="Crie uma conta" component={Register} options={{ headerShown: false }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
