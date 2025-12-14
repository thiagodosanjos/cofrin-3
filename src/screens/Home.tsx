import { View, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/authContext";
import { useAppTheme } from "../contexts/themeContext";
import { useTransactions } from "../hooks/useFirebaseTransactions";
import { useAccounts } from "../hooks/useAccounts";
import { useCreditCards } from "../hooks/useCreditCards";
import { useTransactionRefresh } from "../contexts/transactionRefreshContext";
import { useEffect, useMemo, useCallback } from "react";
import AppHeader from "../components/AppHeader";
import MainLayout from "../components/MainLayout";
import HomeOverview from "../components/home/HomeOverview";
import BalanceCard from "../components/home/BalanceCard";
import TopExpensesCard from "../components/home/TopExpensesCard";
import CreditCardsCard from "../components/home/CreditCardsCard";
import { ACCOUNT_TYPE_LABELS } from "../types/firebase";

export default function Home() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { refreshKey, triggerRefresh } = useTransactionRefresh();
  const navigation = useNavigation<any>();
  const isNarrow = width < 700;
  const userName = user?.displayName || user?.email?.split("@")?.[0] || "Usuário";

  // Mês atual para buscar transações
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Hook do Firebase - totalIncome e totalExpense já consideram apenas status === 'completed'
  const { 
    totalIncome, 
    totalExpense,
    balance,
    refresh 
  } = useTransactions({ 
    month: currentMonth, 
    year: currentYear 
  });

  // Hook de contas do Firebase
  const { accounts, refresh: refreshAccounts } = useAccounts();

  // Hook de cartões de crédito do Firebase
  const { activeCards, refresh: refreshCreditCards } = useCreditCards();

  // Calcular saldo total das contas e formatar para o componente
  const { totalAccountsBalance, formattedAccounts } = useMemo(() => {
    const total = accounts
      .filter(acc => acc.includeInTotal)
      .reduce((sum, acc) => sum + acc.balance, 0);
    
    const formatted = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      type: ACCOUNT_TYPE_LABELS[acc.type] || acc.type,
      balance: acc.balance,
    }));

    return { totalAccountsBalance: total, formattedAccounts: formatted };
  }, [accounts]);

  // Navegar para lançamentos com filtro de conta
  const handleAccountPress = (account: { id?: string; name: string }) => {
    if (account.id) {
      navigation.navigate('Lançamentos', { 
        accountId: account.id, 
        accountName: account.name 
      });
    }
  };

  // Navegar para fatura do cartão de crédito
  const handleCreditCardPress = (card: any) => {
    navigation.navigate('CreditCardBillDetails', {
      creditCardId: card.id,
      creditCardName: card.name,
      month: currentMonth,
      year: currentYear,
    });
  };

  const handleAddCreditCard = () => {
    navigation.navigate('CreditCards');
  };

  // Refresh quando refreshKey mudar
  useEffect(() => {
    if (refreshKey > 0) {
      refresh();
      refreshAccounts();
      refreshCreditCards();
    }
  }, [refreshKey]);

  // Refresh quando a tela ganhar foco (ex: voltar de Lançamentos)
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshAccounts();
      refreshCreditCards();
    }, [])
  );

  return (
    <MainLayout>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 18 }}>
        <AppHeader />
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ width: "100%", maxWidth: 980, paddingHorizontal: 12 }}>
        <HomeOverview
          username={userName}
          revenue={totalIncome}
          expenses={totalExpense}
          onSaveTransaction={triggerRefresh}
        />

        <View style={{ height: 12 }} />
        <View style={{ flexDirection: isNarrow ? 'column' : 'row' }}>
          <View style={{ flex: 1 }}>
            <BalanceCard 
              balance={totalAccountsBalance} 
              accounts={formattedAccounts} 
              onAccountPress={handleAccountPress}
              onAddPress={() => navigation.navigate('ConfigureAccounts')}
            />
          </View>
          <View style={{ width: isNarrow ? '100%' : 12, height: isNarrow ? 12 : 'auto' }} />
          <View style={{ flex: 1 }}>
            <CreditCardsCard 
              cards={activeCards} 
              onCardPress={handleCreditCardPress}
              onAddPress={handleAddCreditCard}
            />
          </View>
        </View>

        <View style={{ height: 12 }} />
        <View style={{ flexDirection: isNarrow ? 'column' : 'row' }}>
          <View style={{ flex: 1 }}>
            <TopExpensesCard 
              onDetailsPress={() => navigation.navigate('Relatórios')}
            />
          </View>
          {!isNarrow && <View style={{ flex: 1 }} />}
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
  subTitle: { fontSize: 14, color: '#94a3b8' },
});
