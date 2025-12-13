import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Platform,
    Pressable,
    Modal, Dimensions
} from 'react-native';
import {
    useTheme, TextInput,
    Text,
    IconButton,
    Button,
    Menu,
    Divider, PaperProvider
} from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
type TransactionType = 'despesa' | 'receita' | 'transfer';
type RecurrenceType = 'none' | 'semanal' | 'quinzenal' | 'mensal' | 'anual';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave?: (payload: {
    type: string;
    amount: number;
    description: string;
    category: string;
    account?: string;
    toAccount?: string;
    date: Date;
    recurrence: RecurrenceType;
  }) => void;
  initialType?: TransactionType;
}

// Constants
const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Educação',
  'Lazer',
  'Vestuário',
  'Serviços',
  'Salário',
  'Investimentos',
  'Outros',
];

const ACCOUNTS = [
  'Nubank',
  'Itaú',
  'Bradesco',
  'Santander',
  'Caixa',
  'Banco do Brasil',
  'Inter',
  'C6 Bank',
  'Carteira',
];

const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'Não repetir', value: 'none' },
  { label: 'Semanal', value: 'semanal' },
  { label: 'Quinzenal', value: 'quinzenal' },
  { label: 'Mensal', value: 'mensal' },
  { label: 'Anual', value: 'anual' },
];

// Helpers
function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '') || '0';
  const num = parseInt(digits, 10);
  const cents = (num % 100).toString().padStart(2, '0');
  const integer = Math.floor(num / 100);
  const integerStr = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${integerStr},${cents}`;
}

function parseCurrency(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,.-]/g, '');
  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(',', '.');
  return parseFloat(normalized) || 0;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AddTransactionModal({
  visible,
  onClose,
  onSave,
  initialType = 'despesa',
}: Props) {
  const theme = useTheme();

  // State
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('R$ 0,00');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Outros');
  const [account, setAccount] = useState('Nubank');
  const [toAccount, setToAccount] = useState('Itaú');
  const [date, setDate] = useState(new Date());
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');

  // Menu visibility states
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showToAccountMenu, setShowToAccountMenu] = useState(false);
  const [showRecurrenceMenu, setShowRecurrenceMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setType(initialType);
      setAmount('R$ 0,00');
      setDescription('');
      setCategory('Outros');
      setAccount('Nubank');
      setToAccount('Itaú');
      setDate(new Date());
      setRecurrence('none');
    }
  }, [visible, initialType]);

  // Colors based on type
  const headerColor = {
    despesa: theme.colors.error,
    receita: theme.colors.primary,
    transfer: '#64748b',
  }[type];

  const handleAmountChange = useCallback((text: string) => {
    setAmount(formatCurrency(text));
  }, []);

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      // No Android, sempre fechar o picker após seleção ou cancelamento
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      // Só atualiza a data se o usuário confirmou (não cancelou)
      if (event.type === 'set' && selectedDate) {
        setDate(selectedDate);
      }
    },
    []
  );

  const handleSave = useCallback(() => {
    const parsed = parseCurrency(amount);
    const value = type === 'despesa' ? -Math.abs(parsed) : parsed;
    onSave?.({
      type,
      amount: value,
      description,
      category,
      account,
      toAccount: type === 'transfer' ? toAccount : undefined,
      date,
      recurrence,
    });
    onClose();
  }, [type, amount, description, category, account, toAccount, date, recurrence, onSave, onClose]);

  // Select field component
  const SelectField = ({
    label,
    value,
    icon,
    visible: menuVisible,
    onOpen,
    onClose: closeMenu,
    options,
    onSelect,
  }: {
    label: string;
    value: string;
    icon: string;
    visible: boolean;
    onOpen: () => void;
    onClose: () => void;
    options: string[];
    onSelect: (value: string) => void;
  }) => (
    <Menu
      visible={menuVisible}
      onDismiss={closeMenu}
      anchor={
        <Pressable onPress={onOpen} style={styles.selectField}>
          <IconButton icon={icon} size={20} style={styles.fieldIcon} />
          <View style={styles.fieldContent}>
            <Text variant="labelSmall" style={styles.fieldLabel}>{label}</Text>
            <Text variant="bodyMedium">{value}</Text>
          </View>
          <IconButton icon="chevron-down" size={20} />
        </Pressable>
      }
      contentStyle={styles.menuContent}
    >
      <ScrollView style={styles.menuScroll}>
        {options.map((option) => (
          <Menu.Item
            key={option}
            title={option}
            onPress={() => {
              onSelect(option);
              closeMenu();
            }}
          />
        ))}
      </ScrollView>
    </Menu>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <PaperProvider>
        <View style={styles.centeredView}>
          <Pressable style={styles.overlay} onPress={onClose} />
          <View style={styles.modalContainer}>
            <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
              {/* Handle */}
              <View style={styles.handle} />

          {/* Header with type selector and amount */}
          <View style={[styles.header, { backgroundColor: headerColor }]}>
            {/* Type chips */}
            <View style={styles.typeSelector}>
              {(['despesa', 'receita', 'transfer'] as TransactionType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeChip,
                    type === t && styles.typeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      type === t && styles.typeChipTextActive,
                    ]}
                  >
                    {t === 'despesa' ? 'Despesa' : t === 'receita' ? 'Receita' : 'Transferência'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Amount input */}
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              mode="flat"
              style={styles.amountInput}
              contentStyle={styles.amountInputContent}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              textColor="#fff"
              placeholderTextColor="rgba(255,255,255,0.6)"
            />
          </View>

          {/* Form fields */}
          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Description */}
            <View style={styles.inputWrapper}>
              <TextInput
                label="Descrição"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                left={<TextInput.Icon icon="text" />}
                style={styles.textInput}
              />
            </View>

            <Divider style={styles.divider} />

            {/* Category */}
            <SelectField
              label="Categoria"
              value={category}
              icon="tag-outline"
              visible={showCategoryMenu}
              onOpen={() => setShowCategoryMenu(true)}
              onClose={() => setShowCategoryMenu(false)}
              options={CATEGORIES}
              onSelect={setCategory}
            />

            <Divider style={styles.divider} />

            {/* Account fields */}
            {type === 'transfer' ? (
              <>
                <SelectField
                  label="De (conta origem)"
                  value={account}
                  icon="bank-transfer-out"
                  visible={showAccountMenu}
                  onOpen={() => setShowAccountMenu(true)}
                  onClose={() => setShowAccountMenu(false)}
                  options={ACCOUNTS}
                  onSelect={setAccount}
                />
                <Divider style={styles.divider} />
                <SelectField
                  label="Para (conta destino)"
                  value={toAccount}
                  icon="bank-transfer-in"
                  visible={showToAccountMenu}
                  onOpen={() => setShowToAccountMenu(true)}
                  onClose={() => setShowToAccountMenu(false)}
                  options={ACCOUNTS.filter((a) => a !== account)}
                  onSelect={setToAccount}
                />
              </>
            ) : (
              <SelectField
                label={type === 'despesa' ? 'Pago com' : 'Recebido em'}
                value={account}
                icon="bank-outline"
                visible={showAccountMenu}
                onOpen={() => setShowAccountMenu(true)}
                onClose={() => setShowAccountMenu(false)}
                options={ACCOUNTS}
                onSelect={setAccount}
              />
            )}

            <Divider style={styles.divider} />

            {/* Date */}
            <Pressable onPress={() => setShowDatePicker(true)} style={styles.selectField}>
              <IconButton icon="calendar" size={20} style={styles.fieldIcon} />
              <View style={styles.fieldContent}>
                <Text variant="labelSmall" style={styles.fieldLabel}>Data</Text>
                <Text variant="bodyMedium">{formatDate(date)}</Text>
              </View>
              <IconButton icon="chevron-right" size={20} />
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}

            <Divider style={styles.divider} />

            {/* Recurrence */}
            <SelectField
              label="Repetir lançamento"
              value={RECURRENCE_OPTIONS.find((r) => r.value === recurrence)?.label || 'Não repetir'}
              icon="repeat"
              visible={showRecurrenceMenu}
              onOpen={() => setShowRecurrenceMenu(true)}
              onClose={() => setShowRecurrenceMenu(false)}
              options={RECURRENCE_OPTIONS.map((r) => r.label)}
              onSelect={(label) => {
                const option = RECURRENCE_OPTIONS.find((r) => r.label === label);
                if (option) setRecurrence(option.value);
              }}
            />

            {/* Save button inside scroll */}
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={handleSave}
                style={[styles.saveButton, { backgroundColor: headerColor }]}
                contentStyle={styles.saveButtonContent}
                labelStyle={styles.saveButtonLabel}
                icon="check"
              >
                Confirmar
              </Button>
            </View>
          </ScrollView>
            </View>
          </View>
        </View>
      </PaperProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '92%',
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
  },
  sheet: {
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.25)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  typeChipActive: {
    backgroundColor: '#fff',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  typeChipTextActive: {
    color: '#1f2937',
  },
  amountInput: {
    backgroundColor: 'transparent',
    fontSize: 32,
  },
  amountInputContent: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 4,
  },
  form: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  inputWrapper: {
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
  divider: {
    marginVertical: 8,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fieldIcon: {
    margin: 0,
    marginRight: 4,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    color: '#6b7280',
    marginBottom: 2,
  },
  menuContent: {
    maxHeight: 300,
  },
  menuScroll: {
    maxHeight: 280,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: 'transparent',
  },
  saveButton: {
    borderRadius: 12,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
