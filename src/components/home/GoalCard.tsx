import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../../theme';
import { Goal } from '../../types/firebase';

interface Props {
  goal: Goal | null;
  progressPercentage: number;
  onCreatePress?: () => void;
  onGoalPress?: () => void;
  onAddPress?: () => void;
}

export default function GoalCard({ goal, progressPercentage, onCreatePress, onGoalPress, onAddPress }: Props) {
  const { colors } = useAppTheme();

  // Card quando NÃO há meta
  if (!goal) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryBg }]}>
            <MaterialCommunityIcons name="target" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Meta financeira</Text>
        </View>

        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Ter um objetivo claro torna suas escolhas financeiras mais fáceis.
        </Text>

        <Pressable
          onPress={onCreatePress}
          style={({ pressed }) => [
            styles.createButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85 }
          ]}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={styles.createButtonText}>Criar meta</Text>
        </Pressable>
      </View>
    );
  }

  // Card quando há meta ativa
  const motivationalText = 
    progressPercentage >= 90 ? 'Falta pouco! 🎯' :
    progressPercentage >= 75 ? 'Você está quase lá!' :
    progressPercentage >= 50 ? 'Metade do caminho já foi!' :
    progressPercentage >= 25 ? 'Todo progresso conta!' :
    progressPercentage > 0 ? 'Ótimo começo!' :
    'Comece agora mesmo!';

  return (
    <Pressable
      onPress={onGoalPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card },
        getShadow(colors),
        pressed && { opacity: 0.95 }
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryBg }]}>
          <MaterialCommunityIcons 
            name={(goal.icon as any) || 'target'} 
            size={24} 
            color={colors.primary} 
          />
        </View>
        <View style={styles.titleContainer}>
          <Text style={[styles.goalName, { color: colors.text }]} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={[styles.motivationalText, { color: colors.textMuted }]}>
            {motivationalText}
          </Text>
        </View>
      </View>

      {/* Barra de progresso */}
      <View style={styles.progressSection}>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${Math.min(progressPercentage, 100)}%`,
                backgroundColor: colors.primary
              }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: colors.primary }]}>
          {Math.round(progressPercentage)}%
        </Text>
      </View>

      {/* Botão adicionar */}
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onAddPress?.();
        }}
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: colors.primaryBg },
          pressed && { opacity: 0.7 }
        ]}
      >
        <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Adicionar progresso</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  motivationalText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
