import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import TransactionsList from '../components/transactions/TransactionsList';
import type { Transaction } from '../state/transactionsState';
import { useTransactionsState, useTransactionsTotals } from '../state/useTransactions';
import { palette } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import AppHeader from '../components/AppHeader';
import MainLayout from '../components/MainLayout';

export default function Launches() {
  const [items, setItems] = useTransactionsState();
  const totals = useTransactionsTotals();


  function handleAdd(transaction: any) {
    const t: Transaction = { id: String(Date.now()), date: new Date().toISOString(), title: transaction.description || 'Novo lançamento', account: transaction.account || 'Conta', amount: transaction.amount, type: transaction.type === 'despesa' ? 'paid' : 'received' };
    setItems((s: Transaction[]) => [t, ...s]);
  }

  // Bootstrapping some demo items if state is empty
  useEffect(() => {
    let mounted = true;

    if (items.length === 0) {
      const mock: Transaction[] = [
        { id: 't1', date: '2025-12-01', title: 'CDI', account: 'Nuconta', amount: 2.3, type: 'received' },
        { id: 't2', date: '2025-12-01', title: 'AZZA3', account: 'Nuconta', amount: 4.45, type: 'received' },
        { id: 't3', date: '2025-12-01', title: 'Parcela Tio Pelé celular 4/8', account: 'Nuconta', amount: 100.0, type: 'received' },
        { id: 't4', date: '2025-12-01', title: 'Miguel Mãe', account: 'Nuconta', amount: 100.0, type: 'received' },
        { id: 't5', date: '2025-12-01', title: 'Água', account: 'Nuconta', amount: -152.6, type: 'paid' },
        { id: 't6', date: '2025-12-01', title: 'Poupança Miguel ( Eu e Mãe )', account: 'Nuconta', amount: 200.0, type: 'received' },
        { id: 't7', date: '2025-12-01', title: 'Escola do Guel', account: 'Nuconta', amount: -803.33, type: 'paid' },
      ];
      if (mounted) setItems(mock);
    }

    return () => {
      mounted = false;
    };
  }, []);

  

  return (
    <MainLayout>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
          <AppHeader />
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: '100%', maxWidth: 980, paddingHorizontal: 12 }}>
              <Text style={styles.title}>Fluxo de caixa</Text>
          {items.length === 0 ? (
            <View style={{ padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 2 }}>
              <Text style={{ fontWeight: '700', marginBottom: 8 }}>Nenhum lançamento encontrado</Text>
              <Text style={{ color: palette.muted }}>Toque no botão + para adicionar sua primeira despesa, receita ou transferência.</Text>
            </View>
          ) : (
            <TransactionsList items={items} />
          )}
          <View style={{ height: 48 }} />
            </View>
          </View>
        </ScrollView>

        <View style={styles.summaryBar}>
        <View style={styles.summaryItem}><Text style={{ color: palette.blue, fontWeight: '700' }}>{formatCurrencyBRL(totals.income)}</Text><Text style={styles.summaryLabel}>entradas</Text></View>
        <View style={styles.summaryItem}><Text style={{ color: palette.danger, fontWeight: '700' }}>{formatCurrencyBRL(-totals.expenses)}</Text><Text style={styles.summaryLabel}>saídas</Text></View>
        <View style={styles.summaryItem}><Text style={{ color: palette.blueDark, fontWeight: '700' }}>{formatCurrencyBRL(totals.balance)}</Text><Text style={styles.summaryLabel}>saldo</Text></View>
      </View>

      </View>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700' },
  summaryBar: { position: 'absolute', left: 12, right: 12, bottom: 84, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 11, color: palette.muted },
  fab: { position: 'absolute', right: 22, bottom: 18, backgroundColor: palette.blue, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
