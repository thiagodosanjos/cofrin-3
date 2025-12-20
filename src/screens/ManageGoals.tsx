import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/authContext';
import { useAppTheme } from '../contexts/themeContext';
import { useAllGoals } from '../hooks/useAllGoals';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import MainLayout from '../components/MainLayout';
import CreateGoalModal from '../components/CreateGoalModal';
import AddToGoalModal from '../components/AddToGoalModal';
import { spacing, borderRadius, getShadow } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import { Goal } from '../types/firebase';
import { Timestamp } from 'firebase/firestore';
import * as goalService from '../services/goalService';
import * as transactionService from '../services/transactionService';
import * as categoryService from '../services/categoryService';

export default function ManageGoals() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { goals, loading, refresh } = useAllGoals();
  const { triggerRefresh } = useTransactionRefresh();
  
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAddToGoalModal, setShowAddToGoalModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Carregar contas quando abrir modal de adicionar
  const loadAccounts = async () => {
    if (!user) return;
    try {
      const { getAllAccounts } = await import('../services/accountService');
      const userAccounts = await getAllAccounts(user.uid);
      setAccounts(userAccounts.filter(acc => !acc.isArchived));
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  // Atualizar quando a tela ganhar foco
  useFocusEffect(
    React.useCallback(() => {
      refresh();
      loadAccounts();
    }, [])
  );

  const handleCreateGoal = () => {
    setSelectedGoal(null);
    setShowGoalModal(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setShowGoalModal(true);
  };

  const handleAddToGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setShowAddToGoalModal(true);
  };

  const handleSaveGoal = async (data: {
    name: string;
    targetAmount: number;
    targetDate: Date;
    icon: string;
  }, setPrimary: boolean = false) => {
    if (!user) return;

    try {
      if (selectedGoal) {
        // Atualizar meta existente
        await goalService.updateGoal(selectedGoal.id, {
          name: data.name,
          targetAmount: data.targetAmount,
          targetDate: Timestamp.fromDate(data.targetDate),
          icon: data.icon,
        });

        // Se deve ser principal, atualizar
        if (setPrimary && !selectedGoal.isPrimary) {
          await goalService.setPrimaryGoal(selectedGoal.id, user.uid);
        }
      } else {
        // Criar nova meta
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
        }, setPrimary); // Passar flag para definir como principal
      }
      
      refresh();
      triggerRefresh();
      setShowGoalModal(false);
    } catch (error: any) {
      console.error('Erro ao salvar meta:', error);
      Alert.alert('Erro', error.message || 'Erro ao salvar meta');
    }
  };

  const handleAddToGoalSubmit = async (amount: number, accountId: string) => {
    if (!selectedGoal || !user) return;
    
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    try {
      // Buscar ou criar categoria de meta
      const metaCategoryId = await categoryService.getOrCreateMetaCategory(user.uid);

      // Criar transação de aporte em meta (expense da conta)
      await transactionService.createTransaction(user.uid, {
        type: 'expense',
        amount: amount,
        description: `Meta: ${selectedGoal.name}`,
        date: Timestamp.now(),
        accountId: accountId,
        categoryId: metaCategoryId,
        recurrence: 'none',
        status: 'completed',
        goalId: selectedGoal.id,
        goalName: selectedGoal.name,
      });
      
      // Adicionar à meta
      await goalService.addToGoalProgress(selectedGoal.id, amount);
      
      refresh();
      triggerRefresh();
      setShowAddToGoalModal(false);
      Alert.alert('Sucesso', 'Progresso adicionado à meta!');
    } catch (error: any) {
      console.error('Erro ao adicionar progresso:', error);
      Alert.alert('Erro', error.message || 'Erro ao adicionar progresso');
    }
  };

  const handleSetPrimary = async (goal: Goal) => {
    if (!user) return;

    try {
      await goalService.setPrimaryGoal(goal.id, user.uid);
      refresh();
      Alert.alert('Sucesso', `"${goal.name}" definida como meta principal!`);
    } catch (error: any) {
      console.error('Erro ao definir meta principal:', error);
      Alert.alert('Erro', error.message || 'Erro ao definir meta principal');
    }
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (!user) return;

    Alert.alert(
      'Excluir meta',
      `Deseja excluir a meta "${goal.name}"?${
        goal.completedAt 
          ? '\n\nOs lançamentos desta meta serão mantidos nas contas originais.' 
          : '\n\nTodos os lançamentos associados serão excluídos.'
      }`,
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

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const progressPercentage = goalService.calculateGoalProgress(goal.currentAmount, goal.targetAmount);
    const isCompleted = !!goal.completedAt;

    return (
      <View style={[styles.goalCard, { backgroundColor: colors.card }, getShadow(colors)]}>
        <Pressable onPress={() => handleEditGoal(goal)}>
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
              {goal.isPrimary && (
                <View style={[styles.primaryBadge, { backgroundColor: colors.primaryBg }]}>
                  <MaterialCommunityIcons name="star" size={12} color={colors.primary} />
                  <Text style={[styles.primaryBadgeText, { color: colors.primary }]}>Principal</Text>
                </View>
              )}
            </View>
            <MaterialCommunityIcons name="pencil" size={20} color={colors.textMuted} />
          </View>

          {/* Progresso */}
          <View style={styles.progressSection}>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                Progresso
              </Text>
              <Text style={[styles.progressValue, { color: isCompleted ? colors.income : colors.text }]}>
                {formatCurrencyBRL(goal.currentAmount)} de {formatCurrencyBRL(goal.targetAmount)}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min(progressPercentage, 100)}%`, 
                    backgroundColor: isCompleted ? colors.income : colors.primary 
                  }
                ]}
              />
            </View>
            <Text style={[styles.progressPercentage, { color: colors.textMuted }]}>
              {Math.round(progressPercentage)}% concluído
            </Text>
          </View>
        </Pressable>

        {/* Ações */}
        <View style={styles.actions}>
          {!isCompleted && (
            <Pressable
              onPress={() => handleAddToGoal(goal)}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.primaryBg },
                pressed && { opacity: 0.7 }
              ]}
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Adicionar</Text>
            </Pressable>
          )}

          {!goal.isPrimary && !isCompleted && goals.length > 1 && (
            <Pressable
              onPress={() => handleSetPrimary(goal)}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: colors.successBg },
                pressed && { opacity: 0.7 }
              ]}
            >
              <MaterialCommunityIcons name="star" size={16} color={colors.income} />
              <Text style={[styles.actionButtonText, { color: colors.income }]}>Definir como principal</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => handleDeleteGoal(goal)}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.dangerBg },
              pressed && { opacity: 0.7 }
            ]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.expense} />
            <Text style={[styles.actionButtonText, { color: colors.expense }]}>Excluir</Text>
          </Pressable>
        </View>
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top || 16, paddingBottom: 100 }
        ]}
      >
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
              </Pressable>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.title, { color: colors.text }]}>Acompanhar minhas metas</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  {goals.length} {goals.length === 1 ? 'meta ativa' : 'metas ativas'}
                </Text>
              </View>
            </View>

            {/* Lista de metas */}
            {goals.length > 0 ? (
              <View style={styles.goalsList}>
                {goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: colors.card }, getShadow(colors)]}>
                <MaterialCommunityIcons name="target" size={64} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Nenhuma meta ativa
                </Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Crie sua primeira meta financeira e comece a acompanhar seu progresso.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FAB para criar nova meta */}
      <FAB
        icon="plus"
        label="Criar nova meta"
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 80 }]}
        onPress={handleCreateGoal}
        color="#fff"
      />

      {/* Modais */}
      <CreateGoalModal
        visible={showGoalModal}
        onClose={() => {
          setShowGoalModal(false);
          setSelectedGoal(null);
        }}
        onSave={(data) => handleSaveGoal(data, false)}
        onDelete={selectedGoal ? () => handleDeleteGoal(selectedGoal) : undefined}
        existingGoal={selectedGoal}
        progressPercentage={
          selectedGoal 
            ? goalService.calculateGoalProgress(selectedGoal.currentAmount, selectedGoal.targetAmount)
            : 0
        }
        showSetPrimaryOption={true}
        onSaveAsPrimary={(data) => handleSaveGoal(data, true)}
      />

      {selectedGoal && (
        <AddToGoalModal
          visible={showAddToGoalModal}
          onClose={() => {
            setShowAddToGoalModal(false);
            setSelectedGoal(null);
          }}
          onSave={handleAddToGoalSubmit}
          goal={selectedGoal}
          progressPercentage={goalService.calculateGoalProgress(selectedGoal.currentAmount, selectedGoal.targetAmount)}
          accounts={accounts}
        />
      )}
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: spacing.md,
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
    gap: spacing.xs,
  },
  goalName: {
    fontSize: 18,
    fontWeight: '600',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
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
  progressPercentage: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
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
});
