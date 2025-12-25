import { View, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/authContext";
import { useAppTheme } from "../contexts/themeContext";
import { useTransactions, useExpensesByCategory, useIncomesByCategory, useMonthReport, usePendingFutureTransactions } from "../hooks/useFirebaseTransactions";
import { useAccounts } from "../hooks/useAccounts";
import { useCreditCards } from "../hooks/useCreditCards";
import { useGoal } from "../hooks/useGoal";
import { useAllGoals } from "../hooks/useAllGoals";
import { useTransactionRefresh } from "../contexts/transactionRefreshContext";
import React, { useEffect, useMemo, useCallback, useState, lazy, Suspense, useDeferredValue } from "react";
import MainLayout from "../components/MainLayout";
import HomeShimmer from "../components/home/HomeShimmer";
import AccountsCard from "../components/home/AccountsCard";
import UpcomingFlowsCard from "../components/home/UpcomingFlowsCard";
import TopCategoriesCard from "../components/TopCategoriesCard";
import CreditCardsCard from "../components/home/CreditCardsCard";
import GoalCard from "../components/home/GoalCard";
import { ACCOUNT_TYPE_LABELS } from "../types/firebase";
import { Timestamp } from "firebase/firestore";
import * as goalService from "../services/goalService";
import * as transactionService from "../services/transactionService";
import * as categoryService from "../services/categoryService";

// Lazy load modais pesados - carregam apenas quando necessário
const CreateGoalModal = lazy(() => import("../components/CreateGoalModal"));
const AddToGoalModal = lazy(() => import("../components/AddToGoalModal"));

export default function Home() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { refreshKey, triggerRefresh } = useTransactionRefresh();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isNarrow = width < 700;
  const userName = user?.displayName || user?.email?.split("@")?.[0] || "Usuário";

  // Determinar saudação baseada na hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Bom dia', icon: 'weather-sunny' as const };
    if (hour >= 12 && hour < 18) return { text: 'Boa tarde', icon: 'weather-partly-cloudy' as const };
    return { text: 'Boa noite', icon: 'weather-night' as const };
  };

  // Mês atual para buscar transações
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Hook do Firebase - totalIncome e totalExpense já consideram apenas status === 'completed'
  const { 
    totalIncome, 
    totalExpense,
    refresh,
    loading: loadingTransactions,
  } = useTransactions({ 
    month: currentMonth, 
    year: currentYear 
  });

  // Hook para transações pendentes futuras (para o card de próximos fluxos)
  const {
    incomeTransactions: pendingIncomes,
    expenseTransactions: pendingExpenses,
    loading: loadingPending,
    refresh: refreshPending,
  } = usePendingFutureTransactions();

  // Hook de relatório do mês (inclui despesas de cartão corretamente)
  const { report } = useMonthReport(currentMonth, currentYear);

  // Hook de contas do Firebase
  const { accounts, refresh: refreshAccounts, loading: loadingAccounts } = useAccounts();

  // Hook de cartões de crédito do Firebase
  const { activeCards, refresh: refreshCreditCards, loading: loadingCards } = useCreditCards();

  // Hook de gastos por categoria
  const { expenses: categoryExpenses } = useExpensesByCategory(currentMonth, currentYear);

  // Hook de receitas por categoria
  const { incomes: categoryIncomes } = useIncomesByCategory(currentMonth, currentYear);

  // Hook de meta financeira
  const { goal, progressPercentage, refresh: refreshGoal } = useGoal();
  
  // Hook de todas as metas (para validar duplicatas)
  const { goals: allGoals, refresh: refreshAllGoals } = useAllGoals();

  // Usar useDeferredValue para dados não críticos (evita bloquear UI)
  const deferredCategoryExpenses = useDeferredValue(categoryExpenses);
  const deferredCategoryIncomes = useDeferredValue(categoryIncomes);
  const deferredGoal = useDeferredValue(goal);

  // Determinar se ainda está carregando dados iniciais
  const isLoading = loadingTransactions || loadingAccounts || loadingCards;

  // Retry automático para novos usuários (dados iniciais podem estar sendo criados)
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    // Se terminou de carregar, contas estão vazias e ainda não tentamos retry
    if (!loadingAccounts && accounts.length === 0 && retryCount < 3) {
      const timer = setTimeout(() => {
        console.log(`Retry ${retryCount + 1}/3: Recarregando dados...`);
        refreshAccounts();
        refresh();
        refreshCreditCards();
        setRetryCount(prev => prev + 1);
      }, 1000); // Espera 1 segundo antes de tentar novamente
      return () => clearTimeout(timer);
    }
  }, [loadingAccounts, accounts.length, retryCount]);

  // Estado do modal de criação de meta
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAddToGoalModal, setShowAddToGoalModal] = useState(false);

  // Criar ou atualizar meta
  const handleSaveGoal = async (data: {
    name: string;
    targetAmount: number;
    targetDate: Date;
    icon: string;
  }) => {
    if (!user) return;

    if (goal) {
      // Atualizar meta existente
      await goalService.updateGoal(goal.id, {
        name: data.name,
        targetAmount: data.targetAmount,
        targetDate: Timestamp.fromDate(data.targetDate),
        icon: data.icon,
      });
    } else {
      // Criar nova meta - calcular timeframe com base na data
      const monthsDiff = Math.ceil((data.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
      const timeframe: 'short' | 'medium' | 'long' = 
        monthsDiff <= 12 ? 'short' : monthsDiff <= 60 ? 'medium' : 'long';
      
      await goalService.createGoal(user.uid, {
        name: data.name,
        targetAmount: data.targetAmount,
        targetDate: Timestamp.fromDate(data.targetDate),
        timeframe,
        icon: data.icon,
        isActive: true,
      }, true); // Definir como principal (primeira meta)
    }
    refreshGoal();
    refreshAllGoals();
  };

  // Adicionar valor à meta (debita da conta selecionada e cria transação)
  const handleAddToGoal = async (amount: number, accountId: string) => {
    if (!goal || !user) return;
    
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    // Buscar ou criar categoria de meta
    const metaCategoryId = await categoryService.getOrCreateMetaCategory(user.uid);

    // Criar transação de aporte em meta (expense da conta)
    await transactionService.createTransaction(user.uid, {
      type: 'expense',
      amount: amount,
      description: `Meta: ${goal.name}`,
      date: Timestamp.now(),
      accountId: accountId,
      categoryId: metaCategoryId,
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
    refreshAllGoals();
    refreshAccounts();
  };

  // Excluir meta
  const handleDeleteGoal = async () => {
    if (!goal || !user) return;
    await goalService.deleteGoal(goal.id, user.uid);
    refreshGoal();
    refreshAllGoals();
    refresh(); // Atualiza transações pois podem ter sido modificadas
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
  const handleAccountPress = useCallback((account: { id?: string; name: string }) => {
    if (account.id) {
      navigation.navigate('Lançamentos', { 
        accountId: account.id, 
        accountName: account.name 
      });
    }
  }, [navigation]);

  // Navegar para fatura do cartão de crédito
  const handleCreditCardPress = useCallback((card: any) => {
    navigation.navigate('CreditCardBillDetails', {
      creditCardId: card.id,
      creditCardName: card.name,
      month: currentMonth,
      year: currentYear,
    });
  }, [navigation, currentMonth, currentYear]);

  const handleAddCreditCard = useCallback(() => {
    navigation.navigate('CreditCards', { openCreate: true });
  }, [navigation]);

  // Callbacks memoizados para evitar re-renders dos componentes filhos
  const openGoalModal = useCallback(() => setShowGoalModal(true), []);
  const closeGoalModal = useCallback(() => setShowGoalModal(false), []);
  const openAddToGoalModal = useCallback(() => setShowAddToGoalModal(true), []);
  const closeAddToGoalModal = useCallback(() => setShowAddToGoalModal(false), []);
  const navigateToManageGoals = useCallback(() => navigation.navigate('ManageGoals'), [navigation]);
  const navigateToConfigureAccounts = useCallback(() => navigation.navigate('ConfigureAccounts'), [navigation]);

  // Refresh quando refreshKey mudar
  useEffect(() => {
    if (refreshKey > 0) {
      refresh();
      refreshAccounts();
      refreshCreditCards();
      refreshPending();
    }
  }, [refreshKey]);

  // Refresh quando a tela ganhar foco (ex: voltar de Lançamentos)
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshAccounts();
      refreshCreditCards();
      refreshPending();
    }, [])
  );

  return (
    <MainLayout>
      <ScrollView 
        style={{ backgroundColor: '#F9FAFB' }} 
        contentContainerStyle={{ 
          paddingTop: insets.top || 16
        }}
      >
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
            {isLoading ? (
              <HomeShimmer />
            ) : (
              <>
                {/* Saudação */}
                <View style={styles.greetingSection}>
                  <View style={styles.greetingRow}>
                    <Text style={[styles.greeting, { color: colors.text }]}>
                      {getGreeting().text}, {userName}
                    </Text>
                    <MaterialCommunityIcons 
                      name={getGreeting().icon} 
                      size={28} 
                      color={colors.text} 
                      style={styles.greetingIcon}
                    />
                  </View>
                </View>

                <View style={{ height: 16 }} />

                {/* Card de contas a receber/pagar */}
                <UpcomingFlowsCard
                  incomeTransactions={pendingIncomes}
                  expenseTransactions={pendingExpenses}
                  loading={loadingPending}
                />

                <View style={{ height: 24 }} />

                {/* 1. Onde está meu dinheiro */}
                <AccountsCard 
                  accounts={accounts}
                  totalBalance={totalAccountsBalance}
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                  username={userName}
                  onAccountPress={handleAccountPress}
                  onAddPress={navigateToConfigureAccounts}
                  showGreeting={false}
                />

            <View style={{ height: 24 }} />

            {/* 3. Meus cartões de crédito */}
            <CreditCardsCard 
              cards={activeCards}
              totalIncome={totalIncome}
              onCardPress={handleCreditCardPress}
              onAddPress={handleAddCreditCard}
            />

            <View style={{ height: 24 }} />

            {/* 4. Meta Financeira */}
            <GoalCard 
              goal={deferredGoal}
              progressPercentage={progressPercentage}
              onCreatePress={openGoalModal}
              onManagePress={navigateToManageGoals}
              onAddPress={openAddToGoalModal}
            />

            <View style={{ height: 24 }} />

            {/* 5. Resumo por Categoria */}
            <TopCategoriesCard
              expenses={deferredCategoryExpenses}
              incomes={deferredCategoryIncomes}
              totalExpenses={report?.expense || totalExpense}
              totalIncomes={report?.income || totalIncome}
            />

            {/* Modais - Lazy loaded com Suspense */}
            <Suspense fallback={null}>
              {showGoalModal && (
                <CreateGoalModal
                  visible={showGoalModal}
                  onClose={closeGoalModal}
                  onSave={handleSaveGoal}
                  onDelete={handleDeleteGoal}
                  existingGoal={goal}
                  existingGoals={allGoals}
                  progressPercentage={progressPercentage}
                />
              )}
            </Suspense>

            <Suspense fallback={null}>
              {goal && showAddToGoalModal && (
                <AddToGoalModal
                  visible={showAddToGoalModal}
                  onClose={closeAddToGoalModal}
                  onSave={handleAddToGoal}
                  goal={goal}
                  progressPercentage={progressPercentage}
                  accounts={accounts}
                />
              )}
            </Suspense>
            </>
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
    padding: 24,
  },
  greetingSection: {
    paddingHorizontal: 4,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingIcon: {
    marginLeft: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
});
