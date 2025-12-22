import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/authContext';
import { useAppTheme } from '../contexts/themeContext';
import { useCompletedGoals } from '../hooks/useCompletedGoals';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import MainLayout from '../components/MainLayout';
import SimpleHeader from '../components/SimpleHeader';
import { FOOTER_HEIGHT } from '../components/AppFooter';
import { spacing, borderRadius, getShadow } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import { Goal, Transaction } from '../types/firebase';
import * as goalService from '../services/goalService';
import * as transactionService from '../services/transactionService';

export default function MyGoals() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { goals, loading, refresh } = useCompletedGoals();
  const { triggerRefresh } = useTransactionRefresh();
  
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [goalTransactions, setGoalTransactions] = useState<Record<string, Transaction[]>>({});

  // Carregar transações de uma meta quando expandir
  const loadGoalTransactions = async (goalId: string) => {
    if (!user || goalTransactions[goalId]) return; // Já carregado

    try {
      const transactions = await transactionService.getTransactionsByGoal(user.uid, goalId);
      setGoalTransactions(prev => ({
        ...prev,
        [goalId]: transactions,
      }));
    } catch (error) {
      console.error('Erro ao carregar transações da meta:', error);
    }
  };

  const toggleGoalExpansion = (goalId: string) => {
    if (expandedGoalId === goalId) {
      setExpandedGoalId(null);
    } else {
      setExpandedGoalId(goalId);
      loadGoalTransactions(goalId);
    }
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (!user) return;

    Alert.alert(
      'Excluir meta concluída',
      `Deseja excluir a meta "${goal.name}"?\n\nOs lançamentos desta meta serão mantidos nas contas originais, mas sem associação à meta.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await goalService.deleteGoal(goal.id, user.uid);
              refresh();
              triggerRefresh();
              Alert.alert('Sucesso', 'Meta excluída com sucesso!');
            } catch (error: any) {
              console.error('Erro ao excluir meta:', error);
              Alert.alert('Erro', error.message || 'Erro ao excluir meta');
            }
          },
        },
      ]
    );
  };

  // Atualizar quando a tela ganhar foco
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [])
  );

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const isExpanded = expandedGoalId === goal.id;
    const transactions = goalTransactions[goal.id] || [];
    const progressPercentage = goalService.calculateGoalProgress(goal.currentAmount, goal.targetAmount);

    const formatDate = (timestamp: any) => {
      if (!timestamp) return 'Data não disponível';
      const date = timestamp.toDate();
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    return (
      <View style={[styles.goalCard, { backgroundColor: colors.card }, getShadow(colors)]}>
        <Pressable onPress={() => toggleGoalExpansion(goal.id)}>
          {/* Header */}
          <View style={styles.goalHeader}>
            <View style={[styles.goalIcon, { backgroundColor: colors.primaryBg }]}>
              <MaterialCommunityIcons
                name={(goal.icon as any) || 'target'}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.goalHeaderText}>
              <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
              <Text style={[styles.goalDate, { color: colors.textMuted }]}>
                Concluída em {formatDate(goal.completedAt)}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={colors.textMuted}
            />
          </View>

          {/* Progresso */}
          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                Objetivo alcançado
              </Text>
              <Text style={[styles.progressValue, { color: colors.income }]}>
                {formatCurrencyBRL(goal.currentAmount)} de {formatCurrencyBRL(goal.targetAmount)}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progressPercentage, 100)}%`, backgroundColor: colors.income }
                ]}
              />
            </View>
            <View style={[styles.completeBadge, { backgroundColor: colors.successBg }]}>
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.income} />
              <Text style={[styles.completeBadgeText, { color: colors.income }]}>
                {Math.round(progressPercentage)}% Completo
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Detalhes expandidos */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Informações da meta */}
            <View style={styles.detailsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Detalhes</Text>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Início:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatDate(goal.createdAt)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Conclusão:</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatDate(goal.completedAt)}
                </Text>
              </View>
              {goal.targetDate && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Meta prevista:</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatDate(goal.targetDate)}
                  </Text>
                </View>
              )}
            </View>

            {/* Lançamentos */}
            {transactions.length > 0 && (
              <View style={styles.transactionsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Lançamentos ({transactions.length})
                </Text>
                {transactions.map((transaction) => (
                  <View
                    key={transaction.id}
                    style={[styles.transactionItem, { backgroundColor: colors.bg }]}
                  >
                    <View style={styles.transactionInfo}>
                      <Text style={[styles.transactionDesc, { color: colors.text }]}>
                        {transaction.description}
                      </Text>
                      <Text style={[styles.transactionDate, { color: colors.textMuted }]}>
                        {formatDate(transaction.date)}
                      </Text>
                    </View>
                    <Text style={[styles.transactionAmount, { color: colors.income }]}>
                      {formatCurrencyBRL(transaction.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Botão de excluir */}
            <Pressable
              onPress={() => handleDeleteGoal(goal)}
              style={({ pressed }) => [
                styles.deleteButton,
                { backgroundColor: colors.dangerBg },
                pressed && { opacity: 0.7 }
              ]}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.expense} />
              <Text style={[styles.deleteButtonText, { color: colors.expense }]}>
                Excluir meta concluída
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <ScrollView
          style={[styles.root, { backgroundColor: colors.bg }]}
          contentContainerStyle={{ paddingTop: insets.top || 16, alignItems: 'center', paddingVertical: 40 }}
        >
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Carregando...
          </Text>
        </ScrollView>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ScrollView
        style={[styles.root, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header simples */}
        <SimpleHeader title="Meus Objetivos" />

        <View style={styles.centeredContainer}>
          <View style={styles.content}>
            {/* Contador de metas */}
            <Text style={[styles.subtitle, { color: colors.textMuted, paddingHorizontal: spacing.lg, marginBottom: spacing.md }]}>
              {goals.length} {goals.length === 1 ? 'meta concluída' : 'metas concluídas'}
            </Text>

            {/* Lista de metas */}
            {goals.length > 0 ? (
              <View style={styles.goalsList}>
                {goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: colors.card }, getShadow(colors)]}>
                <MaterialCommunityIcons name="trophy-outline" size={64} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Nenhuma meta concluída
                </Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Quando você completar uma meta financeira, ela aparecerá aqui para você acompanhar seu histórico.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FAB Voltar - moderno e discreto */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [
          styles.backFab,
          { 
            backgroundColor: colors.card,
            bottom: FOOTER_HEIGHT + Math.max(insets.bottom, 8) + 24,
            shadowColor: colors.text,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
        ]}
      >
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primary} />
      </Pressable>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  centeredContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  goalsList: {
    gap: spacing.md,
  },
  goalCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeaderText: {
    flex: 1,
  },
  goalName: {
    fontSize: 18,
    fontWeight: '600',
  },
  goalDate: {
    fontSize: 13,
    marginTop: 2,
  },
  progressSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  detailsSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionsSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionDate: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  backFab: {
    position: 'absolute',
    right: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});
