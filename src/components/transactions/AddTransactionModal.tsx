import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Modal, Portal, TextInput as PaperInput, Chip, Surface, Text as PaperText, IconButton, Divider, List, FAB } from 'react-native-paper';

interface Props { visible: boolean; onClose: () => void; onSave?: (payload: { type: string; amount: number; description: string; category: string; account?: string; toAccount?: string; date: Date; recurrence: any; }) => void; initialType?: 'despesa'|'receita'|'transfer' }

export default function AddTransactionModal({ visible, onClose, onSave, initialType = 'despesa' }: Props) {
  const theme = useTheme();

  const [type, setType] = useState<'despesa' | 'receita' | 'transfer'>(initialType);
  const [amount, setAmount] = useState('0,00');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Outros');
  const [account, setAccount] = useState('Nuconta');
  const [toAccount, setToAccount] = useState('Nuconta');
  const [date, setDate] = useState(new Date());
  const [recurrence, setRecurrence] = useState<'fixo'|'parcelado'|'none'>('none');
  const [editingDescription, setEditingDescription] = useState(false);
  const descriptionRef = React.useRef<any>(null);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  function parseCurrencyToNumber(input: string) {
    // Accepts "1.234,56" or "1234.56" and returns number 1234.56
    if (!input) return 0;
    let v = input.trim();
    // Remove currency symbols and spaces
    v = v.replace(/[^0-9,.-]/g, '');
    // If contains comma and dot, assume dot is thousands, comma is decimal: '1.234,56'
    if (v.indexOf(',') > -1 && v.indexOf('.') > -1) {
      v = v.replace(/\./g, '').replace(',', '.');
    } else {
      // Replace comma with dot
      v = v.replace(',', '.');
    }
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function handleSave() {
    const parsed = parseCurrencyToNumber(amount);
    const value = type === 'despesa' ? -Math.abs(parsed) : parsed;
    if (onSave) onSave({ type, amount: value, description, category, account, toAccount: type === 'transfer' ? toAccount : undefined, date, recurrence });
    // onClose will be called by parent or we call it here to ensure modal closes
    if (onClose) onClose();
  }
  const amountColor = type === 'despesa' ? (theme.colors?.error || '#B00020') : (theme.colors?.primary || '#2563eb');
  function formatAmountInput(text: string) {
    // keep digits only
    const digits = text.replace(/\D/g, '') || '0';
    const num = parseInt(digits, 10);
    const cents = (num % 100).toString().padStart(2, '0');
    const integer = Math.floor(num / 100).toString();
    const withThousands = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withThousands},${cents}`;
  }

  function handleAmountChange(text: string) {
    // allow pasting formatted or raw numbers
    const formatted = formatAmountInput(text);
    setAmount(formatted);
  }

  useEffect(() => {
    if (editingDescription && descriptionRef.current && descriptionRef.current.focus) {
      descriptionRef.current.focus();
    }
  }, [editingDescription]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        dismissable={true}
          contentContainerStyle={{ height: '100%', justifyContent: 'flex-end', margin: 0, backgroundColor: 'transparent' }}
      >
        <SafeAreaView edges={['bottom']}>
          <View style={{ alignItems: 'stretch' }}>
            <Surface style={[styles.sheet, { backgroundColor: theme.colors.background }]}> 
              <View style={styles.handle} />

              <View style={[styles.headerTop, { backgroundColor: amountColor }] }>
                <View style={{ flex: 1 }}>
                  <PaperText style={[styles.headerTitle, { color: '#fff' }]}>{type === 'despesa' ? 'Despesa' : type === 'receita' ? 'Receita' : 'Transferência'}</PaperText>
                  <View style={styles.chipsContainer}>
                    <Chip selected={type === 'despesa'} onPress={() => setType('despesa')} style={styles.chip} compact mode="outlined">Despesa</Chip>
                    <Chip selected={type === 'receita'} onPress={() => setType('receita')} style={styles.chip} compact mode="outlined">Receita</Chip>
                    <Chip selected={type === 'transfer'} onPress={() => setType('transfer')} style={styles.chip} compact mode="outlined">Transferência</Chip>
                  </View>
                </View>
                <IconButton icon="close" onPress={onClose} accessibilityLabel="Fechar" color="#fff" />
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
                <View style={styles.amountRow}>
                  <PaperInput
                    label="Valor"
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="numeric"
                    mode="flat"
                    style={styles.amountBox}
                    contentStyle={styles.amountInputText}
                    right={<PaperText style={{ marginRight: 8, color: amountColor }}>{type === 'despesa' ? 'R$' : ''}</PaperText>}
                  />
                </View>

                <Divider />

                {editingDescription ? (
                  <View style={{ paddingHorizontal: 8 }}>
                    <PaperInput
                      ref={descriptionRef}
                      label="Descrição"
                      value={description}
                      onChangeText={setDescription}
                      onBlur={() => setEditingDescription(false)}
                      mode="outlined"
                    />
                  </View>
                ) : (
                  <List.Item title="Descrição" description={description || 'Adicione a descrição'} left={() => <List.Icon icon="pencil" />} onPress={() => setEditingDescription(true)} />
                )}
                <Divider />

                <List.Item title="Categoria" description={category} left={() => <List.Icon icon="format-list-bulleted" />} onPress={() => { /* open category picker */ }} />
                <Divider />

                {type !== 'transfer' ? (
                  <List.Item title={type === 'despesa' ? 'Pago com' : 'Recebido em'} description={account} left={() => <List.Icon icon="bank" />} onPress={() => {}} />
                ) : (
                  <>
                    <List.Item title="De" description={account} left={() => <List.Icon icon="arrow-up" />} onPress={() => {}} />
                    <Divider />
                    <List.Item title="Para" description={toAccount} left={() => <List.Icon icon="arrow-down" />} onPress={() => {}} />
                  </>
                )}

                <Divider />

                <List.Item title="Data" description={'Hoje'} left={() => <List.Icon icon="calendar" />} onPress={() => { /* open date picker */ }} />
                <Divider />

                <List.Item title="Repetir lançamento" description={recurrence === 'none' ? 'Não' : recurrence} left={() => <List.Icon icon="repeat" />} onPress={() => {}} />
                <Divider />

              </ScrollView>

              <FAB icon="check" style={styles.fabCenter} onPress={handleSave} large visible color="#fff" />
            </Surface>
          </View>
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.32)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  tab: { paddingHorizontal: 6, paddingVertical: 8, borderRadius: 8 },
  amountRow: { alignItems: 'center', paddingVertical: 8 },
  amountBox: { width: '100%', height: 100, justifyContent: 'center' },
  amountInputText: { fontSize: 40, fontWeight: '700', textAlign: 'center' },
  formRow: { marginVertical: 6 },
  rowTitle: { color: '#6b6b6b', fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: 'transparent' },
  pill: { padding: 10, borderRadius: 8 },
  rowInline: { flexDirection: 'row', alignItems: 'flex-start' },
  smallPill: { padding: 8, borderRadius: 8, marginRight: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: '#16a34a' },
  handle: { width: 48, height: 6, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', alignSelf: 'center', marginBottom: 10 },
  headerTop: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipsContainer: { flexDirection: 'row', marginTop: 8 },
  chip: { marginRight: 8, borderRadius: 12, borderWidth: 1 },
  amountBig: { fontSize: 44, fontWeight: '700', color: '#fff' },
  fabCenter: { position: 'absolute', alignSelf: 'center', bottom: -36, backgroundColor: '#16a34a', width: 84, height: 84, borderRadius: 42, justifyContent: 'center', elevation: 8, zIndex: 1000, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
});
