import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Login from "../screens/Login";
import Register from "../screens/Register";
import Home from "../screens/Home";
import Settings from "../screens/Settings";
import EditProfile from "../screens/EditProfile";
import ConfigureAccounts from "../screens/ConfigureAccounts";
import CreditCards from "../screens/CreditCards";
import CreditCardBillDetails from "../screens/CreditCardBillDetails";
import Categories from "../screens/Categories";
import CategoryDetails from "../screens/CategoryDetails";
import About from "../screens/About";
import Education from "../screens/Education";
import { useAuth } from "../contexts/authContext";
import Launches from "../screens/Launches";
import Reports from "../screens/Reports";
import Goals from "../screens/Goals";

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
          <Stack.Screen name="Metas do ano" component={Goals} />
          <Stack.Screen name="Configurações" component={Settings} />
          <Stack.Screen name="EditProfile" component={EditProfile} />
          <Stack.Screen name="ConfigureAccounts" component={ConfigureAccounts} />
          <Stack.Screen name="CreditCards" component={CreditCards} />
          <Stack.Screen name="CreditCardBillDetails" component={CreditCardBillDetails} />
          <Stack.Screen name="Categories" component={Categories} />
          <Stack.Screen name="CategoryDetails" component={CategoryDetails} />
          <Stack.Screen name="About" component={About} />
          <Stack.Screen name="Education" component={Education} />
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
