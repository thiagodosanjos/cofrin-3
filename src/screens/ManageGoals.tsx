import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/authContext';
import { useAppTheme } from '../contexts/themeContext';
import { useAllGoals } from '../hooks/useAllGoals';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import MainLayout from '../components/MainLayout';
import SimpleHeader from '../components/SimpleHeader';
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

  // Função de exclusão direta (usada pelo CreateGoalModal que já tem confirmação própria)
  const deleteGoalDirectly = async (goal: Goal) => {
    if (!user) return;
    
    try {
      await goalService.deleteGoal(goal.id, user.uid);
      refresh();
      triggerRefresh();
      setShowGoalModal(false);
      setSelectedGoal(null);
    } catch (error: any) {
      console.error('Erro ao excluir meta:', error);
      throw error; // Propagar erro para o modal tratar
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
    
    // Calcular tempo restante e aporte mensal
    const timeRemaining = goalService.calculateTimeRemaining(goal.targetDate);
    const monthlyContribution = goalService.calculateMonthlyContribution(
      goal.currentAmount,
      goal.targetAmount,
      goal.targetDate
    );

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
          
          {/* Informações de tempo e aporte */}
          {!isCompleted && timeRemaining && (
            <View style={styles.timeInfoSection}>
              <View style={styles.timeInfoRow}>
                <View style={styles.timeInfoItem}>
                  <MaterialCommunityIcons 
                    name="calendar-clock" 
                    size={16} 
                    color={timeRemaining.isOverdue ? colors.expense : colors.textMuted} 
                  />
                  <Text style={[
                    styles.timeInfoLabel, 
                    { color: timeRemaining.isOverdue ? colors.expense : colors.textMuted }
                  ]}>
                    {timeRemaining.isOverdue ? 'Prazo:' : 'Faltam:'}
                  </Text>
                  <Text style={[
                    styles.timeInfoValue, 
                    { color: timeRemaining.isOverdue ? colors.expense : colors.text }
                  ]}>
                    {timeRemaining.formattedText}
                  </Text>
                </View>
              </View>
              
              {monthlyContribution && !timeRemaining.isOverdue && (
                <View style={styles.timeInfoRow}>
                  <View style={styles.timeInfoItem}>
                    <MaterialCommunityIcons 
                      name="cash-multiple" 
                      size={16} 
                      color={colors.textMuted} 
                    />
                    <Text style={[styles.timeInfoLabel, { color: colors.textMuted }]}>
                      Aporte necessário:
                    </Text>
                    <Text style={[styles.timeInfoValue, { color: colors.primary, fontWeight: '600' }]}>
                      {formatCurrencyBRL(monthlyContribution.monthlyAmount)} {monthlyContribution.formattedText}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
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
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Adicionar progresso</Text>
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
      <SimpleHeader title="Metas Financeiras" />
      <ScrollView
        style={[styles.root, { backgroundColor: colors.bg }]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 }
        ]}
      >
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
            {/* Subtítulo com contagem */}
            <Text style={[styles.subtitle, { color: colors.textMuted, marginBottom: spacing.md }]}>
              {goals.length} {goals.length === 1 ? 'meta ativa' : 'metas ativas'}
            </Text>

            {/* Botão para gerenciar metas */}
            <Pressable
              onPress={() => navigation.navigate('Meus Objetivos')}
              style={({ pressed }) => [
                styles.manageButton,
                { 
                  backgroundColor: pressed ? colors.primaryLight : colors.card,
                  borderColor: colors.primary,
                },
                getShadow(colors)
              ]}
            >
              <View style={[styles.manageButtonIcon, { backgroundColor: colors.primaryLight }]}>
                <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.manageButtonText}>
                <Text style={[styles.manageButtonTitle, { color: colors.text }]}>Meus Objetivos</Text>
                <Text style={[styles.manageButtonDesc, { color: colors.textMuted }]}>Configurar e editar suas metas</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
            </Pressable>

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

      {/* Botão fixo colado ao footer */}
      <View style={[styles.addGoalFixedContainer, { paddingBottom: Math.max(insets.bottom, 8) + 12 }]}>
        <Pressable
          onPress={handleCreateGoal}
          style={({ pressed }) => [
            styles.addGoalButtonFixed,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={styles.addGoalButtonText}>Criar nova meta</Text>
        </Pressable>
      </View>

      {/* Modais */}
      <CreateGoalModal
        visible={showGoalModal}
        onClose={() => {
          setShowGoalModal(false);
          setSelectedGoal(null);
        }}
        onSave={(data) => handleSaveGoal(data, false)}
        onDelete={selectedGoal ? () => deleteGoalDirectly(selectedGoal) : undefined}
        existingGoal={selectedGoal}
        existingGoals={goals}
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
  timeInfoSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    gap: spacing.md,
  },
  timeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  timeInfoLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeInfoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.md,
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
  addGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  addGoalButtonText: {
    color: '#fff',
    fontSize: 16,
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
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  manageButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  manageButtonText: {
    flex: 1,
  },
  manageButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  manageButtonDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
