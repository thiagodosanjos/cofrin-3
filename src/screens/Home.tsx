import { View, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/authContext";
import { useAppTheme } from "../contexts/themeContext";
import { useTransactions, useExpensesByCategory, useMonthReport } from "../hooks/useFirebaseTransactions";
import { useAccounts } from "../hooks/useAccounts";
import { useCreditCards } from "../hooks/useCreditCards";
import { useGoal } from "../hooks/useGoal";
import { useTransactionRefresh } from "../contexts/transactionRefreshContext";
import { useEffect, useMemo, useCallback, useState } from "react";
import AppHeader from "../components/AppHeader";
import MainLayout from "../components/MainLayout";
import HomeOverview from "../components/home/HomeOverview";
import FinancialHealthCard from "../components/home/FinancialHealthCard";
import TopCategoryCard from "../components/home/TopCategoryCard";
import CreditCardsCard from "../components/home/CreditCardsCard";
import GoalCard from "../components/home/GoalCard";
import CreateGoalModal from "../components/CreateGoalModal";
import AddToGoalModal from "../components/AddToGoalModal";
import { ACCOUNT_TYPE_LABELS } from "../types/firebase";
import { Timestamp } from "firebase/firestore";
import * as goalService from "../services/goalService";
import * as transactionService from "../services/transactionService";
import { spacing } from "../theme";

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

  // Hook de relatório do mês (inclui despesas de cartão corretamente)
  const { report } = useMonthReport(currentMonth, currentYear);

  // Hook de contas do Firebase
  const { accounts, refresh: refreshAccounts } = useAccounts();

  // Hook de cartões de crédito do Firebase
  const { activeCards, refresh: refreshCreditCards } = useCreditCards();

  // Hook de gastos por categoria
  const { expenses: categoryExpenses } = useExpensesByCategory(currentMonth, currentYear);

  // Hook de meta financeira
  const { goal, progressPercentage, refresh: refreshGoal } = useGoal();

  // Estado do modal de criação de meta
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAddToGoalModal, setShowAddToGoalModal] = useState(false);

  // Criar ou atualizar meta
  const handleSaveGoal = async (data: {
    name: string;
    targetAmount: number;
    timeframe: 'short' | 'medium' | 'long';
    icon: string;
  }) => {
    if (!user) return;

    if (goal) {
      // Atualizar meta existente
      await goalService.updateGoal(goal.id, {
        name: data.name,
        targetAmount: data.targetAmount,
        timeframe: data.timeframe,
        icon: data.icon,
      });
    } else {
      // Criar nova meta
      await goalService.createGoal(user.uid, {
        name: data.name,
        targetAmount: data.targetAmount,
        timeframe: data.timeframe,
        icon: data.icon,
        isActive: true,
      });
    }
    refreshGoal();
  };

  // Adicionar valor à meta (debita da conta selecionada e cria transação)
  const handleAddToGoal = async (amount: number, accountId: string) => {
    if (!goal || !user) return;
    
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    // Criar transação de aporte em meta (expense da conta)
    await transactionService.createTransaction(user.uid, {
      type: 'expense',
      amount: amount,
      description: `Meta: ${goal.name}`,
      date: Timestamp.now(),
      accountId: accountId,
      recurrence: 'none',
      status: 'completed',
      goalId: goal.id,
      goalName: goal.name,
    });
    
    // Adicionar à meta
    await goalService.addToGoalProgress(goal.id, amount);
    
    // Atualizar dados
    refresh(); // Atualiza transações
    refreshGoal();
    refreshAccounts();
  };

  // Excluir meta
  const handleDeleteGoal = async () => {
    if (!goal) return;
    await goalService.deleteGoal(goal.id);
    refreshGoal();
  };

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
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 120 }}>
        <AppHeader />
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
            {/* 1. Header contextual com acesso rápido */}
            <HomeOverview
              username={userName}
              revenue={totalIncome}
              expenses={totalExpense}
              onSaveTransaction={triggerRefresh}
            />

            <View style={{ height: spacing.lg }} />

            {/* 2. Saúde financeira do mês */}
            <FinancialHealthCard 
              income={totalIncome}
              expense={totalExpense}
              balance={balance}
            />

            <View style={{ height: spacing.lg }} />

            {/* 3. Onde você gastou (categoria principal) */}
            <TopCategoryCard 
              expenses={categoryExpenses}
              totalExpenses={report?.expense || totalExpense}
              onPress={() => navigation.navigate('Relatórios')}
            />

            <View style={{ height: spacing.lg }} />

            {/* 4. Compromissos de cartão (modo alerta) */}
            <CreditCardsCard 
              cards={activeCards}
              onCardPress={handleCreditCardPress}
              onAddPress={handleAddCreditCard}
            />

            {activeCards.filter(c => (c.currentUsed || 0) > 0).length > 0 && (
              <View style={{ height: spacing.lg }} />
            )}

            {/* 5. Meta financeira */}
            <GoalCard 
              goal={goal}
              progressPercentage={progressPercentage}
              onCreatePress={() => setShowGoalModal(true)}
              onGoalPress={() => setShowGoalModal(true)}
              onAddPress={() => setShowAddToGoalModal(true)}
            />

            {/* Modais */}
            <CreateGoalModal
              visible={showGoalModal}
              onClose={() => setShowGoalModal(false)}
              onSave={handleSaveGoal}
              onDelete={handleDeleteGoal}
              existingGoal={goal}
            />

            {goal && (
              <AddToGoalModal
                visible={showAddToGoalModal}
                onClose={() => setShowAddToGoalModal(false)}
                onSave={handleAddToGoal}
                goal={goal}
                progressPercentage={progressPercentage}
                accounts={accounts}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    padding: spacing.lg,
  },
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
