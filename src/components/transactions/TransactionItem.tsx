import { memo } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrencyBRL } from '../../utils/format';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius } from '../../theme';

interface Props {
  icon?: string; // letter or emoji
  title: string;
  account?: string;
  amount: number; // numeric value; positive = income, negative = expense
  type?: 'received' | 'paid' | 'transfer';
  category?: string;
  categoryIcon?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  goalName?: string; // Se for aporte em meta
  isLocked?: boolean; // Se for pagamento de fatura (não pode ser editado)
  onPress?: () => void;
  onEdit?: () => void;
  onStatusPress?: () => void;
}

function TransactionItemComponent({ 
  icon = '◻', 
  title, 
  account, 
  amount, 
  type, 
  category,
  categoryIcon,
  status = 'completed',
  goalName,
  isLocked = false,
  onPress,
  onEdit,
  onStatusPress,
}: Props) {
  const { colors } = useAppTheme();
  
  // Cores específicas para cada tipo de transação
  const incomeColor = '#10b981';  // Verde claro
  const expenseColor = '#dc2626'; // Vermelho
  const transferColor = '#64748b'; // Cinza
  const goalColor = colors.primary; // Cor da meta (teal)
  
  const getColor = () => {
    if (goalName) return goalColor; // Aporte em meta usa cor primária
    if (type === 'transfer') return transferColor;
    if (type === 'paid' || amount < 0) return expenseColor;
    return incomeColor;
  };
  
  const color = isLocked ? colors.textMuted : getColor();
  const initial = title.charAt(0).toUpperCase();

  // Subtítulo: categoria + conta (ou indicação de meta)
  const subtitle = goalName 
    ? `Meta • ${account || ''}`.replace(/ • $/, '')
    : [category, account].filter(Boolean).join(' • ');
  
  // Cor e ícone do status
  const statusColor = status === 'completed' ? '#10b981' : colors.textMuted;
  const statusIcon = status === 'completed' ? 'check-circle' : 'circle-outline';

  return (
    <Pressable
      onPress={isLocked ? undefined : onPress}
      disabled={isLocked}
      style={({ pressed }) => [
        styles.row,
        { 
          backgroundColor: isLocked ? colors.grayLight : (pressed ? colors.grayLight : colors.card), 
          borderBottomColor: colors.border,
          opacity: isLocked ? 0.6 : 1,
        }
      ]}
    >
      {/* Ícone de status (concluído/pendente) */}
      <Pressable
        onPress={isLocked ? undefined : onStatusPress}
        disabled={isLocked}
        hitSlop={8}
        style={({ pressed }) => [
          styles.statusButton,
          { opacity: pressed ? 0.6 : 1 }
        ]}
      >
        <MaterialCommunityIcons name={statusIcon} size={20} color={statusColor} />
      </Pressable>

      <View style={[styles.avatar, { backgroundColor: color + '15' }]}>
        {goalName ? (
          <MaterialCommunityIcons name="flag-checkered" size={20} color={color} />
        ) : categoryIcon ? (
          <MaterialCommunityIcons name={categoryIcon as any} size={20} color={color} />
        ) : (
          <Text style={[styles.avatarLabel, { color }]}>{initial}</Text>
        )}
      </View>
      
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: status === 'pending' ? colors.textMuted : colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {isLocked && (
            <MaterialCommunityIcons name="lock" size={14} color={colors.textMuted} style={{ marginLeft: 6 }} />
          )}
        </View>
        {subtitle && <Text style={[styles.account, { color: colors.textMuted }]}>{subtitle}</Text>}
        {isLocked && (
          <Text style={[styles.lockedLabel, { color: colors.textMuted }]}>Pagamento de fatura • Não editável</Text>
        )}
      </View>
      
      <Text style={[styles.amount, { color: status === 'pending' ? colors.textMuted : color }]}>{formatCurrencyBRL(amount)}</Text>
      
      {onEdit && !isLocked && (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: pressed ? colors.grayLight : 'transparent' }
          ]}
        >
          <MaterialCommunityIcons name="pencil" size={18} color={colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

export default memo(TransactionItemComponent);

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderRadius: borderRadius.sm,
    marginBottom: 2,
  },
  statusButton: {
    marginRight: spacing.xs,
    padding: 2,
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: borderRadius.md,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  avatarLabel: { 
    fontWeight: '700',
    fontSize: 16,
  },
  content: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
  },
  account: {
    fontSize: 13,
    marginTop: 2,
  },
  lockedLabel: {
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  amount: { 
    fontWeight: '700', 
    fontSize: 15,
  },
  editButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
});
