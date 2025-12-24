import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../../theme';
import { formatCurrencyBRL } from '../../utils/format';
import type { Transaction } from '../../types/firebase';

interface Props {
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
  loading?: boolean;
}

export default function UpcomingFlowsCard({
  incomeTransactions,
  expenseTransactions,
  loading = false,
}: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Calcular totais
  const totalIncome = useMemo(() => {
    return incomeTransactions
      .filter(tx => tx.status === 'pending')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [incomeTransactions]);

  const totalExpense = useMemo(() => {
    return expenseTransactions
      .filter(tx => tx.status === 'pending')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [expenseTransactions]);

  // Determinar quais slides mostrar
  const slides: Array<{ type: 'income' | 'expense'; total: number }> = [];
  if (totalIncome > 0) {
    slides.push({ type: 'income', total: totalIncome });
  }
  if (totalExpense > 0) {
    slides.push({ type: 'expense', total: totalExpense });
  }

  // Se não há nenhum fluxo pendente, não renderizar o card
  if (slides.length === 0 || loading) {
    return null;
  }

  const currentData = slides[currentSlide];
  const hasMultipleSlides = slides.length > 1;

  const handlePrevious = () => {
    setCurrentSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentSlide(prev => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const handlePress = () => {
    navigation.navigate('Lançamentos', { 
      filterStatus: 'pending',
      filterType: currentData.type,
    });
  };

  const getMessage = () => {
    if (currentData.type === 'income') {
      return (
        <Text style={[styles.message, { color: colors.text }]}>
          Opa, vi que você tem{' '}
          <Text style={[styles.highlight, { color: colors.income }]}>
            contas a receber
          </Text>
          {' '}no total de{' '}
          <Text style={[styles.amount, { color: colors.income }]}>
            {formatCurrencyBRL(currentData.total)}
          </Text>
        </Text>
      );
    }
    return (
      <Text style={[styles.message, { color: colors.text }]}>
        Você também tem{' '}
        <Text style={[styles.highlight, { color: colors.expense }]}>
          contas a pagar
        </Text>
        {' '}no valor total de{' '}
        <Text style={[styles.amount, { color: colors.expense }]}>
          {formatCurrencyBRL(currentData.total)}
        </Text>
      </Text>
    );
  };

  const accentColor = currentData.type === 'income' ? colors.income : colors.expense;

  // Mostrar seta esquerda apenas no slide 2+ e seta direita apenas antes do último
  const showLeftArrow = hasMultipleSlides && currentSlide > 0;
  const showRightArrow = hasMultipleSlides && currentSlide < slides.length - 1;

  return (
    <Pressable 
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
        getShadow(colors),
      ]}
    >
      <View style={styles.content}>
        {/* Seta esquerda - apenas no segundo slide */}
        {showLeftArrow && (
          <Pressable 
            onPress={(e) => { e.stopPropagation(); handlePrevious(); }}
            style={styles.arrowButton}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Conteúdo central */}
        <View style={styles.centerContent}>
          {getMessage()}
        </View>

        {/* Seta direita - apenas no primeiro slide */}
        {showRightArrow && (
          <Pressable 
            onPress={(e) => { e.stopPropagation(); handleNext(); }}
            style={styles.arrowButton}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowButton: {
    paddingHorizontal: spacing.xs,
  },
  centerContent: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  highlight: {
    fontWeight: '600',
  },
  amount: {
    fontWeight: '700',
  },
});
