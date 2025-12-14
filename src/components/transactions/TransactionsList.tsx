import { View, Text, StyleSheet } from 'react-native';
import TransactionItem from './TransactionItem';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing } from '../../theme';

export interface TransactionListItem {
  id: string;
  date: string;
  title: string;
  account: string;
  amount: number;
  type: 'paid' | 'received' | 'transfer';
  category?: string;
  categoryIcon?: string;
}

interface Props { 
  items: TransactionListItem[];
  onEditItem?: (item: TransactionListItem) => void;
}

export default function TransactionsList({ items = [], onEditItem }: Props) {
  const { colors } = useAppTheme();
  
  // group by date (simple grouping: same date string -> header)
  const groups: Record<string, TransactionListItem[]> = {};
  items.forEach((t) => {
    const date = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    if (!groups[date]) groups[date] = [];
    groups[date].push(t);
  });

  const dates = Object.keys(groups);

  return (
    <View>
      {dates.map((d) => (
        <View key={d} style={styles.group}>
          <Text style={[styles.dateHeader, { color: colors.textMuted }]}>{d}</Text>
          {groups[d].map((tx) => (
            <TransactionItem 
              key={tx.id}
              title={tx.title} 
              account={tx.account} 
              amount={tx.amount} 
              type={tx.type}
              category={tx.category}
              categoryIcon={tx.categoryIcon}
              onEdit={() => onEditItem?.(tx)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.md,
  },
  dateHeader: { 
    marginVertical: spacing.sm, 
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'capitalize',
  },
});
