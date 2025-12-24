import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/themeContext';
import { getShadow } from '../../theme';
import { Goal } from '../../types/firebase';

// Cores do design system - Roxo
const primaryDark = '#4A2FA8';   // roxo escuro (títulos h1)
const primary = '#5B3CC4';       // roxo principal (botões, ícones)
const primaryBg = '#EDE9FF';     // fundo roxo suave (backgrounds de ícones)
const progressBg = '#E8E6F3';    // fundo barras de progresso

interface Props {
  goal: Goal | null;
  progressPercentage: number;
  onCreatePress?: () => void;
  onManagePress?: () => void; // Navegar para tela de gerenciamento
  onAddPress?: () => void;
}

export default function GoalCard({ goal, progressPercentage, onCreatePress, onManagePress, onAddPress }: Props) {
  const { colors } = useAppTheme();
  
  // Verificar se meta está completa
  const isGoalComplete = goal ? goal.currentAmount >= goal.targetAmount : false;

  // Card quando NÃO há meta
  if (!goal) {
    return (
      <View style={[styles.card, { backgroundColor: '#fff' }, getShadow(colors)]}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: primaryBg }]}>
            <MaterialCommunityIcons name="target" size={20} color={primary} />
          </View>
          <Text style={[styles.title, { color: primaryDark }]}>Meta financeira</Text>
        </View>

        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Ter um objetivo claro torna suas escolhas financeiras mais fáceis.
        </Text>

        <Pressable
          onPress={onCreatePress}
          style={({ pressed }) => [
            styles.createButton,
            { backgroundColor: primary },
            pressed && { opacity: 0.85 }
          ]}
        >
          <MaterialCommunityIcons name="plus" size={16} color="#fff" />
          <Text style={styles.createButtonText}>Criar meta</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: '#fff' },
        getShadow(colors),
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: primaryBg }]}>
          <MaterialCommunityIcons 
            name={(goal.icon as any) || 'target'} 
            size={20} 
            color={primary} 
          />
        </View>
        <View style={styles.goalHeaderText}>
          <Text style={[styles.goalTitle, { color: isGoalComplete ? colors.success : colors.textMuted }]}>
            {isGoalComplete ? 'Meta atingida!' : 'Objetivos em andamento'}
          </Text>
          <Text style={[styles.goalName, { color: colors.text }]} numberOfLines={1}>
            {goal.name}
          </Text>
        </View>
      </View>

      {/* Barra de progresso */}
      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: progressBg }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${Math.min(progressPercentage, 100)}%`,
                backgroundColor: isGoalComplete ? colors.success : primary
              }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: isGoalComplete ? colors.success : primary }]}>
          {Math.round(progressPercentage)}%
        </Text>
      </View>

      {/* Botões de ação */}
      <View style={styles.actionsRow}>
        {/* Botão de adicionar progresso - esconder quando meta completa */}
        {!isGoalComplete && (
          <Pressable
            onPress={onAddPress}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.primaryBg },
              pressed && { opacity: 0.7 }
            ]}
          >
            <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Adicionar progresso</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onManagePress}
          style={({ pressed }) => [
            styles.manageButton,
            { backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary },
            pressed && { opacity: 0.85 }
          ]}
        >
          
          <Text style={[styles.manageButtonText, { color: colors.primary }]}>Acompanhar minhas metas</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
  },
  goalHeaderText: {
    flex: 1,
    gap: 2,
  },
  goalTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  actionsRow: {
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
