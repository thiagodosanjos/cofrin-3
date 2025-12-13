import React, { useState } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { Card, Text, useTheme, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AddTransactionModal from '../../components/transactions/AddTransactionModal';
import { useTransactionsState } from '../../state/useTransactions';
import { formatCurrencyBRL } from '../../utils/format';
import { palette, spacing, borderRadius } from '../../theme';

interface Props {
  username?: string;
  revenue?: number | string;
  expenses?: number | string;
  onCreateTransaction?: (payload: any) => void;
}

export default function HomeOverview({ 
  username = 'Usuário', 
  revenue = 0, 
  expenses = 0, 
  onCreateTransaction 
}: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'transfer'>('despesa');
  const [items, setItems] = useTransactionsState();
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const openModal = (type: 'despesa' | 'receita' | 'transfer') => {
    setModalType(type);
    setModalVisible(true);
  };

  const handleSave = (payload: any) => {
    setModalVisible(false);

    const tx = {
      id: String(Date.now()),
      date: payload?.date instanceof Date 
        ? payload.date.toISOString() 
        : new Date().toISOString(),
      title: payload.description || 
        (payload.type === 'despesa' ? 'Despesa' : payload.type === 'receita' ? 'Receita' : 'Transferência'),
      account: payload.account || 'Conta',
      category: payload.category,
      amount: payload.amount,
      type: payload.type === 'despesa' ? 'paid' : payload.type === 'receita' ? 'received' : 'transfer',
    };

    try {
      setItems((s: any[]) => [tx, ...s]);
    } catch {
      onCreateTransaction?.(payload);
    }

    onCreateTransaction?.(payload);
    setSnackbarVisible(true);
  };

  // Action button component
  const ActionButton = ({ 
    icon, 
    color, 
    label, 
    onPress 
  }: { 
    icon: string; 
    color: string; 
    label: string; 
    onPress: () => void;
  }) => (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.actionButton,
        { opacity: pressed ? 0.8 : 1 }
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color="#fff" />
      </View>
      <Text variant="labelSmall" style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );

  // Stat component
  const StatItem = ({ 
    label, 
    value, 
    color, 
    align = 'left' 
  }: { 
    label: string; 
    value: string; 
    color: string; 
    align?: 'left' | 'right';
  }) => (
    <View style={[styles.statItem, align === 'right' && styles.statItemRight]}>
      <Text variant="bodySmall" style={styles.statLabel}>{label}</Text>
      <Text variant="titleMedium" style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  return (
    <>
      <Card style={styles.card} mode="elevated">
        {/* Greeting */}
        <Text variant="headlineSmall" style={styles.greeting}>
          Olá, {username}
        </Text>

        {/* Quick Actions */}
        <View style={[styles.actionsRow, isSmallScreen && styles.actionsRowSmall]}>
          <ActionButton
            icon="minus"
            color={theme.colors.error}
            label="DESPESA"
            onPress={() => openModal('despesa')}
          />
          <ActionButton
            icon="plus"
            color={theme.colors.primary}
            label="RECEITA"
            onPress={() => openModal('receita')}
          />
          <ActionButton
            icon="swap-horizontal"
            color="#64748b"
            label="TRANSF."
            onPress={() => openModal('transfer')}
          />
        </View>

        {/* Stats Section */}
        <Text variant="labelMedium" style={styles.sectionTitle}>Visão geral</Text>
        
        <View style={styles.statsRow}>
          <StatItem 
            label="Receitas no mês" 
            value={formatCurrencyBRL(revenue)} 
            color={theme.colors.primary} 
          />
          <StatItem 
            label="Despesas no mês" 
            value={formatCurrencyBRL(expenses)} 
            color={theme.colors.error}
            align="right"
          />
        </View>
      </Card>

      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialType={modalType}
        onSave={handleSave}
      />

      <Snackbar 
        visible={snackbarVisible} 
        onDismiss={() => setSnackbarVisible(false)} 
        duration={2000}
      >
        Lançamento salvo com sucesso!
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  greeting: {
    fontWeight: '600',
    marginBottom: spacing.lg,
    color: palette.text,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  actionsRowSmall: {
    gap: spacing.md,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
  },
  actionLabel: {
    marginTop: spacing.sm,
    color: palette.textSecondary,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: palette.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
  },
  statItemRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontWeight: '700',
    fontSize: 18,
  },
});
