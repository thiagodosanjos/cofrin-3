import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppFooter, { FOOTER_HEIGHT } from './AppFooter';
import AddTransactionModal from './transactions/AddTransactionModal';
import { useTransactionsState } from '../state/useTransactions';
import type { Transaction } from '../state/transactionsState';

type Props = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useTransactionsState();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'transfer'>('despesa');

  const bottomPad = useMemo(() => FOOTER_HEIGHT + Math.max(insets.bottom, 10) + 22, [insets.bottom]);

  function openAdd() {
    setModalType('despesa');
    setModalVisible(true);
  }

  function handleSave(payload: any) {
    if (!payload) return;

    if (payload.type === 'transfer') {
      const debit: Transaction = {
        id: String(Date.now()) + '_from',
        date: payload.date?.toISOString ? payload.date.toISOString() : new Date().toISOString(),
        title: payload.description || 'Transferência',
        account: payload.account || 'Conta',
        amount: -Math.abs(payload.amount),
        type: 'transfer',
      };
      const credit: Transaction = {
        id: String(Date.now()) + '_to',
        date: payload.date?.toISOString ? payload.date.toISOString() : new Date().toISOString(),
        title: payload.description || 'Transferência',
        account: payload.toAccount || 'Conta',
        amount: Math.abs(payload.amount),
        type: 'transfer',
      };
      setItems((s: any) => [credit, debit, ...s]);
      return;
    }

    const t: Transaction = {
      id: String(Date.now()),
      date: payload.date?.toISOString ? payload.date.toISOString() : new Date().toISOString(),
      title: payload.description || (payload.type === 'despesa' ? 'Despesa' : 'Receita'),
      account: payload.account || 'Conta',
      amount: payload.amount,
      type: payload.type === 'despesa' ? 'paid' : 'received',
    };

    setItems((s: any) => [t, ...s]);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingBottom: bottomPad }]}>{children}</View>

      <AppFooter
        onHome={() => navigation.navigate('Bem-vindo' as any)}
        onAdd={openAdd}
        onReports={() => navigation.navigate('Relatórios' as any)}
      />

      <AddTransactionModal
        visible={modalVisible}
        initialType={modalType}
        onClose={() => setModalVisible(false)}
        onSave={(p) => {
          handleSave(p);
          setModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
