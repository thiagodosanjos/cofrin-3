import { View, Text, StyleSheet, Pressable } from 'react-native';
import TransactionItem from './TransactionItem';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing } from '../../theme';

interface TransactionListItem {
  id: string;
  date: string;
  title: string;
  account: string;
  amount: number;
  type: string;
  category?: string;
  categoryIcon?: string;
}

interface Props { 
  items: TransactionListItem[];
  onDeleteItem?: (id: string) => void;
}

export default function TransactionsList({ items = [], onDeleteItem }: Props) {
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
            <Pressable
              key={tx.id}
              onLongPress={() => onDeleteItem?.(tx.id)}
              delayLongPress={500}
            >
              <TransactionItem 
                title={tx.title} 
                account={tx.account} 
                amount={tx.amount} 
                type={tx.type as 'paid' | 'received'}
                category={tx.category}
                categoryIcon={tx.categoryIcon}
              />
            </Pressable>
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
