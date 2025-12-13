import { View, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { useAuth } from "../contexts/authContext";
import { palette } from "../theme";
import AppHeader from "../components/AppHeader";
import MainLayout from "../components/MainLayout";
import HomeOverview from "../components/home/HomeOverview";
import BalanceCard from "../components/home/BalanceCard";
import TopExpensesCard from "../components/home/TopExpensesCard";

export default function Home() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isNarrow = width < 700;
  const emailPrefix = user?.email?.split("@")?.[0] || user?.displayName || "Usuário";

  return (
    <MainLayout>
      <ScrollView style={{ backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 18 }}>
        <AppHeader />
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ width: "100%", maxWidth: 980, paddingHorizontal: 12 }}>
        <HomeOverview
          username={emailPrefix}
          revenue={'R$ 20.358,44'}
          expenses={'R$ 11.820,15'}
          actions={[{ key: 'despesa', label: 'DESPESA' }, { key: 'receita', label: 'RECEITA' }, { key: 'transf', label: 'TRANSF.' }]}
        />

        <View style={{ height: 12 }} />
        <View style={{ flexDirection: isNarrow ? 'column' : 'row' }}>
          <View style={{ flex: 1 }}>
            <BalanceCard balance={2637} accounts={[{ name: 'CARTEIRA FÍSICA', type: 'Conta manual', balance: 30 }, { name: 'Nuconta', type: 'Conta manual', balance: 2607.47 }]} />
          </View>
          <View style={{ width: isNarrow ? '100%' : 12, height: isNarrow ? 12 : 'auto' }} />
          <View style={{ flex: 1 }}>
            <TopExpensesCard />
          </View>
        </View>
          </View>
        </View>
      </ScrollView>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, marginBottom: 12 },
  avatarContainer: { alignItems: "center", marginBottom: 12 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarName: { fontSize: 16 },
  subTitle: { fontSize: 14, color: palette.muted },
});
