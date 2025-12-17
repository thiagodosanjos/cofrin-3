import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppFooter, { FOOTER_HEIGHT } from './AppFooter';
import AddTransactionModal from './transactions/AddTransactionModal';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';

type Props = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: Props) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const { triggerRefresh } = useTransactionRefresh();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'despesa' | 'receita' | 'transfer'>('despesa');

  const bottomPad = useMemo(
    () => FOOTER_HEIGHT + 6 + Math.max(insets.bottom, 8) + 16,
    [insets.bottom]
  );

  function openAdd() {
    setModalType('despesa');
    setModalVisible(true);
  }

  function handleSave() {
    // Trigger refresh for all screens listening to transaction changes
    triggerRefresh();
    setModalVisible(false);
  }

  return (
    <View style={styles.root}>
      <View style={[styles.content, { paddingBottom: bottomPad }]}>{children}</View>

      <AppFooter
        onHome={() => navigation.navigate('Bem-vindo' as any)}
        onAdd={openAdd}
        onLaunches={() => navigation.navigate('Lançamentos' as any)}
        onReports={() => navigation.navigate('Relatórios' as any)}
        onOthers={() => navigation.navigate('Configurações' as any)}
      />

      <AddTransactionModal
        visible={modalVisible}
        initialType={modalType}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
