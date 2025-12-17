import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../../theme';
import { formatCurrencyBRL } from '../../utils/format';
import { CreditCard } from '../../types/firebase';

interface Props {
  cards?: CreditCard[];
  totalBills?: number;
  onCardPress?: (card: CreditCard) => void;
  onAddPress?: () => void;
}

// Cores para os cartões baseado no nome
const getCardColor = (name: string, customColor?: string): string => {
  if (customColor) return customColor;
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export default function CreditCardsCard({ cards = [], totalBills = 0, onCardPress, onAddPress }: Props) {
  const { colors } = useAppTheme();
  
  // Filtrar apenas cartões com uso atual > 0 (compromissos pendentes)
  const cardsWithCommitments = cards.filter(card => (card.currentUsed || 0) > 0);
  
  // Verificar se há alertas de alto uso (> 80%)
  const hasHighUsage = cardsWithCommitments.some(card => {
    const usagePercent = card.limit > 0 ? ((card.currentUsed || 0) / card.limit) * 100 : 0;
    return usagePercent > 80;
  });

  if (cardsWithCommitments.length === 0) {
    return null; // Não mostrar o card se não houver compromissos
  }

  // Componente de item do cartão (simplificado)
  const CardRow = ({ card }: { card: CreditCard }) => {
    const cardColor = getCardColor(card.name, card.color);
    const used = card.currentUsed || 0;
    const usagePercent = card.limit > 0 ? (used / card.limit) * 100 : 0;
    const isHighUsage = usagePercent > 80;
    
    return (
      <Pressable
        onPress={() => onCardPress?.(card)}
        style={({ pressed }) => [
          styles.cardRow,
          { backgroundColor: pressed ? colors.grayLight : 'transparent' }
        ]}
      >
        <View style={[styles.cardIcon, { backgroundColor: `${cardColor}15` }]}>
          <MaterialCommunityIcons
            name={(card.icon as any) || 'credit-card'}
            size={20}
            color={cardColor}
          />
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
            {card.name}
          </Text>
          <Text style={[styles.cardDue, { color: colors.textMuted }]}>
            Vence dia {card.dueDay}
          </Text>
        </View>

        <View style={styles.cardBill}>
          <Text style={[
            styles.billValue, 
            { color: isHighUsage ? colors.expense : colors.text }
          ]}>
            {formatCurrencyBRL(used)}
          </Text>
          {isHighUsage && (
            <View style={[styles.alertBadge, { backgroundColor: colors.dangerBg }]}>
              <MaterialCommunityIcons name="alert" size={12} color={colors.danger} />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
      {/* Header com alerta */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons 
              name={hasHighUsage ? "alert-circle" : "calendar-clock"} 
              size={20} 
              color={hasHighUsage ? colors.expense : colors.primary} 
            />
            <Text style={[styles.title, { color: colors.text }]}>
              Compromissos de cartão
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {cardsWithCommitments.length} fatura{cardsWithCommitments.length > 1 ? 's' : ''} pendente{cardsWithCommitments.length > 1 ? 's' : ''} este mês
          </Text>
        </View>
      </View>

      {/* Lista de cartões com compromissos */}
      <View style={styles.cardsList}>
        {cardsWithCommitments.map((card) => (
          <CardRow key={card.id} card={card} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  titleSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
  },
  cardsList: {
    gap: spacing.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  cardDue: {
    fontSize: 12,
  },
  cardBill: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  billValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
});
