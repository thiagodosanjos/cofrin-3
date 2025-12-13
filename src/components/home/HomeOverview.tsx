import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, IconButton, useTheme } from 'react-native-paper';
import QuickActions from '../../components/QuickActions';
import OverviewStat from '../../components/OverviewStat';
import AddTransactionModal from '../../components/transactions/AddTransactionModal';
import { spacing } from '../../theme';
import { Snackbar } from 'react-native-paper';
import { useTransactionsState } from '../../state/useTransactions';

interface Props {
  username?: string;
  revenue?: number | string;
  expenses?: number | string;
  actions?: Array<any>;
  onCreateTransaction?: (payload: any) => void;
}

import { formatCurrencyBRL } from '../../utils/format';

export default function HomeOverview({ username = 'Usuário', revenue = 0, expenses = 0, actions = [], onCreateTransaction }: Props) {
  const theme = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'transfer'>('despesa');

  const [items, setItems] = useTransactionsState();
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  function openModal(type: 'despesa' | 'receita' | 'transfer') {
    console.log('[HomeOverview] openModal', type);
    setModalType(type);
    setModalVisible(true);
  }

  const defaultActions = [
    { key: 'despesa', label: 'Despesa', icon: 'minus', onPress: () => openModal('despesa') },
    { key: 'receita', label: 'Receita', icon: 'plus', onPress: () => openModal('receita') },
    { key: 'transfer', label: 'Transferência', icon: 'swap-horizontal', onPress: () => openModal('transfer') },
  ];

  // If parent passed actions, merge them with defaults so missing onPress will open modal
  const defaultByKey: Record<string, any> = {};
  defaultActions.forEach((a) => (defaultByKey[a.key] = a));

  function normalizeKey(k: string) {
    if (!k) return k;
    const s = String(k).toLowerCase();
    if (s.startsWith('trans')) return 'transfer';
    return s;
  }

  const actionsToRender = (actions && actions.length > 0)
    ? actions.map((a: any) => {
        const key = normalizeKey(a.key ?? a);
        const def = defaultByKey[key] || {};
        return { ...def, ...a, key };
      })
    : defaultActions;

  return (
    <ErrorBoundary>
      <Card style={styles.card} mode="elevated">
        <View style={styles.headerRow}>
          <Title style={styles.title}>Olá, {username}</Title>
          <IconButton icon="bell-outline" size={20} onPress={() => {}} accessibilityLabel="Notificações" />
        </View>

        <QuickActions actions={actionsToRender} onAction={(key) => {
          const k = normalizeKey(String(key));
          if (k === 'despesa' || k === 'receita' || k === 'transfer') openModal(k as any);
        }} />

        <Title style={styles.subTitle}>Visão geral</Title>

        <View style={styles.row}>
          <OverviewStat label="Receitas no mês" value={formatCurrencyBRL(revenue)} color={theme.colors.primary} />
          <OverviewStat label="Despesas no mês" value={formatCurrencyBRL(expenses)} color={(theme as any).colors?.error || '#B00020'} align="right" />
        </View>
      </Card>

      <AddTransactionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        initialType={modalType}
        onSave={(payload) => {
          setModalVisible(false);

          // Build a Transaction object compatible with transactionsState.Transaction
          const tx = {
            id: String(Date.now()),
            date: payload?.date ? (payload.date instanceof Date ? payload.date.toISOString() : new Date(payload.date).toISOString()) : new Date().toISOString(),
            title: payload.description || (payload.type === 'despesa' ? 'Despesa' : payload.type === 'receita' ? 'Receita' : 'Transferência'),
            account: payload.account || 'Conta',
            category: payload.category,
            amount: payload.amount,
            type: payload.type === 'despesa' ? 'paid' : payload.type === 'receita' ? 'received' : 'transfer',
          } as any;

          // Update global transactions state
          try {
            setItems((s: any[]) => [tx, ...s]);
          } catch (e) {
            // If parent provided a callback, call it as fallback
            if (onCreateTransaction) onCreateTransaction(payload);
          }

          // Also notify parent if provided
          if (onCreateTransaction) onCreateTransaction(payload);

          // Show confirmation snackbar
          setSnackbarMsg('Lançamento salvo');
          setSnackbarVisible(true);
        }}
      />

      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={2500} action={{ label: 'Fechar', onPress: () => setSnackbarVisible(false) }}>
        {snackbarMsg}
      </Snackbar>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component<any, { hasError: boolean; error?: Error; info?: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught', error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: 16 }}>
          <Title>Erro ao renderizar</Title>
          <View style={{ height: 8 }} />
          <OverviewStat label="Erro" value={String(this.state.error ?? 'unknown')} />
        </View>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, marginBottom: 8 },
  subTitle: { fontSize: 14, marginTop: 10, color: '#6b6b6b' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});
