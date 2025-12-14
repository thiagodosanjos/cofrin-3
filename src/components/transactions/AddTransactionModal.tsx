import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Platform,
    Pressable,
    Modal,
    Dimensions,
    Text,
    TextInput,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp } from 'firebase/firestore';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../../theme';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useTransactions } from '../../hooks/useFirebaseTransactions';
import { TransactionType, RecurrenceType, CreateTransactionInput } from '../../types/firebase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
type LocalTransactionType = 'despesa' | 'receita' | 'transfer';
type PickerType = 'none' | 'category' | 'account' | 'toAccount' | 'creditCard' | 'recurrence' | 'date';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void;
  initialType?: LocalTransactionType;
}

// Constants
const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'Não repetir', value: 'none' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quinzenal', value: 'weekly' }, // TODO: Implementar quinzenal
  { label: 'Mensal', value: 'monthly' },
  { label: 'Anual', value: 'yearly' },
];

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function AddTransactionModal({
  visible,
  onClose,
  onSave,
  initialType = 'despesa',
}: Props) {
  const { colors } = useAppTheme();

  // Firebase hooks
  const { categories } = useCategories();
  const { activeAccounts } = useAccounts();
  const { activeCards } = useCreditCards();
  const { createTransaction } = useTransactions();

  // State
  const [type, setType] = useState<LocalTransactionType>(initialType);
  const [amount, setAmount] = useState('R$ 0,00');
  const [description, setDescription] = useState('');
  
  // Category state
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('Outros');
  
  // Account state
  const [accountId, setAccountId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [toAccountName, setToAccountName] = useState('');
  
  // Credit card state (optional for expenses)
  const [creditCardId, setCreditCardId] = useState('');
  const [creditCardName, setCreditCardName] = useState('');
  const [useCreditCard, setUseCreditCard] = useState(false);
  
  const [date, setDate] = useState(new Date());
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [saving, setSaving] = useState(false);

  // Single picker state - evita modais aninhados
  const [activePicker, setActivePicker] = useState<PickerType>('none');
  
  // Date picker state for custom calendar
  const [tempDate, setTempDate] = useState(new Date());

  // Set default account when accounts load
  useEffect(() => {
    if (activeAccounts.length > 0 && !accountId) {
      setAccountId(activeAccounts[0].id);
      setAccountName(activeAccounts[0].name);
      if (activeAccounts.length > 1) {
        setToAccountId(activeAccounts[1].id);
        setToAccountName(activeAccounts[1].name);
      }
    }
  }, [activeAccounts.length]); // Apenas quando o tamanho muda

  // Set default category when categories load
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      const defaultCat = categories.find(c => c.name === 'Outros') || categories[0];
      setCategoryId(defaultCat.id);
      setCategoryName(defaultCat.name);
    }
  }, [categories.length]); // Apenas quando o tamanho muda

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setType(initialType);
      setAmount('R$ 0,00');
      setDescription('');
      setDate(new Date());
      setRecurrence('none');
      setActivePicker('none');
      setUseCreditCard(false);
      setCreditCardId('');
      setCreditCardName('');
      setSaving(false);
      
      // Reset to defaults
      if (activeAccounts.length > 0) {
        setAccountId(activeAccounts[0].id);
        setAccountName(activeAccounts[0].name);
        if (activeAccounts.length > 1) {
          setToAccountId(activeAccounts[1].id);
          setToAccountName(activeAccounts[1].name);
        }
      }
      if (categories.length > 0) {
        const defaultCat = categories.find(c => c.name === 'Outros') || categories[0];
        setCategoryId(defaultCat.id);
        setCategoryName(defaultCat.name);
      }
    }
  }, [visible, initialType]); // Removido activeAccounts e categories

  // Sync tempDate when opening date picker
  useEffect(() => {
    if (activePicker === 'date') {
      setTempDate(date);
    }
  }, [activePicker, date]);

  // Colors based on type
  const typeColors = {
    despesa: '#dc2626',
    receita: '#10b981',
    transfer: '#64748b',
  };
  
  const headerColor = typeColors[type];

  const handleAmountChange = useCallback((text: string) => {
    setAmount(formatCurrency(text));
  }, []);

  const handleDateChangeNative = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setActivePicker('none');
      }
      if (event.type === 'set' && selectedDate) {
        setDate(selectedDate);
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    const parsed = parseCurrency(amount);
    if (parsed <= 0) {
      Alert.alert('Erro', 'O valor deve ser maior que zero');
      return;
    }

    if (!accountId && !useCreditCard) {
      Alert.alert('Erro', 'Selecione uma conta');
      return;
    }

    if (type === 'transfer' && !toAccountId) {
      Alert.alert('Erro', 'Selecione a conta de destino');
      return;
    }

    setSaving(true);
    try {
      // Map local type to Firebase type
      const firebaseType: TransactionType = 
        type === 'despesa' ? 'expense' : 
        type === 'receita' ? 'income' : 'transfer';

      // Build transaction data without undefined fields
      const transactionData: CreateTransactionInput = {
        type: firebaseType,
        amount: parsed,
        description: description.trim() || categoryName,
        date: Timestamp.fromDate(date),
        accountId: useCreditCard && type === 'despesa' ? '' : accountId,
        recurrence,
        status: 'completed',
      };

      // Add optional fields only if they have values
      if (type !== 'transfer' && categoryId) {
        transactionData.categoryId = categoryId;
      }
      if (type === 'transfer' && toAccountId) {
        transactionData.toAccountId = toAccountId;
      }
      if (useCreditCard && type === 'despesa' && creditCardId) {
        transactionData.creditCardId = creditCardId;
      }

      const result = await createTransaction(transactionData);

      if (result) {
        Alert.alert('Sucesso', 'Lançamento salvo!');
        onSave?.();
        onClose();
      } else {
        Alert.alert('Erro', 'Não foi possível salvar o lançamento');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [
    type, amount, description, categoryId, categoryName,
    accountId, toAccountId, creditCardId, useCreditCard,
    date, recurrence, createTransaction, onSave, onClose
  ]);

  // Componente de campo selecionável
  const SelectField = ({
    label,
    value,
    icon,
    onPress,
  }: {
    label: string;
    value: string;
    icon: string;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectField,
        { backgroundColor: pressed ? colors.grayLight : 'transparent' },
      ]}
    >
      <View style={[styles.fieldIcon, { backgroundColor: colors.primaryBg }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
      </View>
      <View style={styles.fieldContent}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: colors.text }]}>{value}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );

  // Custom Date Picker Component (funciona em todas as plataformas)
  const CustomDatePicker = () => {
    const year = tempDate.getFullYear();
    const month = tempDate.getMonth();
    const day = tempDate.getDate();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days = [];
    // Empty slots for days before the first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const goToPrevMonth = () => {
      const newDate = new Date(tempDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setTempDate(newDate);
    };

    const goToNextMonth = () => {
      const newDate = new Date(tempDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setTempDate(newDate);
    };

    const selectDay = (selectedDay: number) => {
      const newDate = new Date(year, month, selectedDay);
      setDate(newDate);
      setActivePicker('none');
    };

    const isToday = (d: number) => {
      const today = new Date();
      return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    const isSelected = (d: number) => {
      return d === date.getDate() && month === date.getMonth() && year === date.getFullYear();
    };

    return (
      <View style={[styles.datePickerContainer, { backgroundColor: colors.card }]}>
        <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.pickerTitle, { color: colors.text }]}>Selecionar Data</Text>
          <Pressable onPress={() => setActivePicker('none')} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Month/Year Navigation */}
        <View style={styles.calendarHeader}>
          <Pressable onPress={goToPrevMonth} style={styles.calendarNavButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.primary} />
          </Pressable>
          <Text style={[styles.calendarTitle, { color: colors.text }]}>
            {MONTHS[month]} {year}
          </Text>
          <Pressable onPress={goToNextMonth} style={styles.calendarNavButton}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {/* Weekday Headers */}
        <View style={styles.weekdayRow}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <Text key={i} style={[styles.weekdayText, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {days.map((d, i) => (
            <View key={i} style={styles.dayCell}>
              {d !== null && (
                <Pressable
                  onPress={() => selectDay(d)}
                  style={[
                    styles.dayButton,
                    isSelected(d) && { backgroundColor: colors.primary },
                    isToday(d) && !isSelected(d) && { backgroundColor: colors.primaryBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: colors.text },
                      isSelected(d) && { color: '#fff', fontWeight: '600' },
                      isToday(d) && !isSelected(d) && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {d}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={[styles.quickDateActions, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => {
              setDate(new Date());
              setActivePicker('none');
            }}
            style={[styles.quickDateButton, { backgroundColor: colors.primaryBg }]}
          >
            <Text style={[styles.quickDateText, { color: colors.primary }]}>Hoje</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // Render Picker Content based on activePicker
  const renderPickerContent = () => {
    if (activePicker === 'none') return null;

    // Para data no iOS/Android nativo
    if (activePicker === 'date' && Platform.OS !== 'web') {
      return (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChangeNative}
        />
      );
    }

    // Custom date picker for web
    if (activePicker === 'date') {
      return <CustomDatePicker />;
    }

    // Render category picker
    if (activePicker === 'category') {
      const filteredCategories = categories.filter(c => 
        type === 'despesa' ? c.type === 'expense' : c.type === 'income'
      );
      
      return (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Selecionar Categoria</Text>
            <Pressable onPress={() => setActivePicker('none')} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
            {filteredCategories.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setCategoryId(cat.id);
                  setCategoryName(cat.name);
                  setActivePicker('none');
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  { backgroundColor: pressed ? colors.grayLight : 'transparent' },
                  categoryId === cat.id && { backgroundColor: colors.primaryBg },
                ]}
              >
                <View style={styles.pickerOptionWithIcon}>
                  <MaterialCommunityIcons 
                    name={(cat.icon || 'tag') as any} 
                    size={20} 
                    color={categoryId === cat.id ? colors.primary : colors.textMuted} 
                  />
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: colors.text, marginLeft: spacing.sm },
                      categoryId === cat.id && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </View>
                {categoryId === cat.id && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Render account picker
    if (activePicker === 'account') {
      return (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              {type === 'transfer' ? 'Conta de Origem' : 'Selecionar Conta'}
            </Text>
            <Pressable onPress={() => setActivePicker('none')} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
            {activeAccounts.map((acc) => (
              <Pressable
                key={acc.id}
                onPress={() => {
                  setAccountId(acc.id);
                  setAccountName(acc.name);
                  setUseCreditCard(false);
                  setActivePicker('none');
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  { backgroundColor: pressed ? colors.grayLight : 'transparent' },
                  accountId === acc.id && !useCreditCard && { backgroundColor: colors.primaryBg },
                ]}
              >
                <View style={styles.pickerOptionWithIcon}>
                  <MaterialCommunityIcons 
                    name={(acc.icon || 'bank') as any} 
                    size={20} 
                    color={accountId === acc.id && !useCreditCard ? colors.primary : colors.textMuted} 
                  />
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: colors.text, marginLeft: spacing.sm },
                      accountId === acc.id && !useCreditCard && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {acc.name}
                  </Text>
                </View>
                {accountId === acc.id && !useCreditCard && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
            
            {/* Credit cards option for expenses */}
            {type === 'despesa' && activeCards.length > 0 && (
              <>
                <View style={[styles.pickerDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.pickerSectionTitle, { color: colors.textMuted }]}>
                  CARTÕES DE CRÉDITO
                </Text>
                {activeCards.map((card) => (
                  <Pressable
                    key={card.id}
                    onPress={() => {
                      setCreditCardId(card.id);
                      setCreditCardName(card.name);
                      setUseCreditCard(true);
                      setActivePicker('none');
                    }}
                    style={({ pressed }) => [
                      styles.pickerOption,
                      { backgroundColor: pressed ? colors.grayLight : 'transparent' },
                      creditCardId === card.id && useCreditCard && { backgroundColor: colors.primaryBg },
                    ]}
                  >
                    <View style={styles.pickerOptionWithIcon}>
                      <MaterialCommunityIcons 
                        name="credit-card" 
                        size={20} 
                        color={creditCardId === card.id && useCreditCard ? colors.primary : colors.textMuted} 
                      />
                      <Text
                        style={[
                          styles.pickerOptionText,
                          { color: colors.text, marginLeft: spacing.sm },
                          creditCardId === card.id && useCreditCard && { color: colors.primary, fontWeight: '600' },
                        ]}
                      >
                        {card.name}
                      </Text>
                    </View>
                    {creditCardId === card.id && useCreditCard && (
                      <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      );
    }

    // Render toAccount picker (for transfers)
    if (activePicker === 'toAccount') {
      const filteredAccounts = activeAccounts.filter(a => a.id !== accountId);
      
      return (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Conta de Destino</Text>
            <Pressable onPress={() => setActivePicker('none')} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
            {filteredAccounts.map((acc) => (
              <Pressable
                key={acc.id}
                onPress={() => {
                  setToAccountId(acc.id);
                  setToAccountName(acc.name);
                  setActivePicker('none');
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  { backgroundColor: pressed ? colors.grayLight : 'transparent' },
                  toAccountId === acc.id && { backgroundColor: colors.primaryBg },
                ]}
              >
                <View style={styles.pickerOptionWithIcon}>
                  <MaterialCommunityIcons 
                    name={(acc.icon || 'bank') as any} 
                    size={20} 
                    color={toAccountId === acc.id ? colors.primary : colors.textMuted} 
                  />
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: colors.text, marginLeft: spacing.sm },
                      toAccountId === acc.id && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {acc.name}
                  </Text>
                </View>
                {toAccountId === acc.id && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Render recurrence picker
    if (activePicker === 'recurrence') {
      return (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Repetir Lançamento</Text>
            <Pressable onPress={() => setActivePicker('none')} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
            {RECURRENCE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setRecurrence(option.value);
                  setActivePicker('none');
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  { backgroundColor: pressed ? colors.grayLight : 'transparent' },
                  recurrence === option.value && { backgroundColor: colors.primaryBg },
                ]}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    { color: colors.text },
                    recurrence === option.value && { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  {option.label}
                </Text>
                {recurrence === option.value && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.centeredView}>
        <Pressable style={styles.overlay} onPress={onClose} />
        
        {/* Main Modal or Picker */}
        {activePicker !== 'none' ? (
          // Picker overlay
          <View style={styles.pickerOverlay}>
            <Pressable 
              style={StyleSheet.absoluteFill} 
              onPress={() => setActivePicker('none')} 
            />
            {renderPickerContent()}
          </View>
        ) : (
          // Main form
          <View style={[styles.modalContainer, getShadow(colors, 'lg')]}>
            <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
              {/* Header colorido */}
              <View style={[styles.header, { backgroundColor: headerColor }]}>
                {/* Botão fechar */}
                <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
                  <MaterialCommunityIcons name="close" size={24} color="#fff" />
                </Pressable>

                {/* Título */}
                <Text style={styles.headerTitle}>
                  {type === 'despesa' ? 'Nova Despesa' : type === 'receita' ? 'Nova Receita' : 'Nova Transferência'}
                </Text>

                {/* Type selector */}
                <View style={styles.typeSelector}>
                  {(['despesa', 'receita', 'transfer'] as LocalTransactionType[]).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={[
                        styles.typeChip,
                        type === t && styles.typeChipActive,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={t === 'despesa' ? 'arrow-down' : t === 'receita' ? 'arrow-up' : 'swap-horizontal'}
                        size={16}
                        color={type === t ? headerColor : 'rgba(255,255,255,0.7)'}
                      />
                      <Text
                        style={[
                          styles.typeChipText,
                          type === t && styles.typeChipTextActive,
                        ]}
                      >
                        {t === 'despesa' ? 'Despesa' : t === 'receita' ? 'Receita' : 'Transf.'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Amount input */}
                <TextInput
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  style={styles.amountInput}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  selectionColor="#fff"
                />
              </View>

              {/* Form fields */}
              <ScrollView
                style={styles.form}
                contentContainerStyle={styles.formContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Descrição */}
                <View style={[styles.inputContainer, { backgroundColor: colors.card }, getShadow(colors)]}>
                  <View style={[styles.fieldIcon, { backgroundColor: colors.primaryBg }]}>
                    <MaterialCommunityIcons name="text" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Descrição</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Ex: Almoço, Salário..."
                      placeholderTextColor={colors.textMuted}
                      style={[styles.textInput, { color: colors.text }]}
                    />
                  </View>
                </View>

                {/* Card de campos */}
                <View style={[styles.fieldsCard, { backgroundColor: colors.card }, getShadow(colors)]}>
                  {/* Categoria - não mostrar para transferências */}
                  {type !== 'transfer' && (
                    <>
                      <SelectField
                        label="Categoria"
                        value={categoryName}
                        icon="tag-outline"
                        onPress={() => setActivePicker('category')}
                      />
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    </>
                  )}

                  {/* Conta */}
                  {type === 'transfer' ? (
                    <>
                      <SelectField
                        label="De (conta origem)"
                        value={accountName || 'Selecione'}
                        icon="bank-transfer-out"
                        onPress={() => setActivePicker('account')}
                      />
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      <SelectField
                        label="Para (conta destino)"
                        value={toAccountName || 'Selecione'}
                        icon="bank-transfer-in"
                        onPress={() => setActivePicker('toAccount')}
                      />
                    </>
                  ) : (
                    <SelectField
                      label={type === 'despesa' ? 'Pago com' : 'Recebido em'}
                      value={useCreditCard ? creditCardName : (accountName || 'Selecione')}
                      icon={useCreditCard ? 'credit-card' : 'bank-outline'}
                      onPress={() => setActivePicker('account')}
                    />
                  )}
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  {/* Data */}
                  <SelectField
                    label="Data"
                    value={formatDate(date)}
                    icon="calendar"
                    onPress={() => setActivePicker('date')}
                  />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  {/* Recorrência */}
                  <SelectField
                    label="Repetir"
                    value={RECURRENCE_OPTIONS.find((r) => r.value === recurrence)?.label || 'Não repetir'}
                    icon="repeat"
                    onPress={() => setActivePicker('recurrence')}
                  />
                </View>
              </ScrollView>

              {/* Botão Salvar - fixo no fundo */}
              <View style={[styles.buttonContainer, { backgroundColor: colors.bg }]}>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.saveButton,
                    { backgroundColor: headerColor },
                    pressed && { opacity: 0.9 },
                    saving && { opacity: 0.6 },
                  ]}
                >
                  <MaterialCommunityIcons name={saving ? 'loading' : 'check'} size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Confirmar'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
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
    maxWidth: 500,
    height: SCREEN_HEIGHT * 0.75,
    maxHeight: SCREEN_HEIGHT * 0.88,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  sheet: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    gap: spacing.xs,
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
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 0,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
  },
  textInput: {
    fontSize: 15,
    paddingVertical: 2,
  },
  fieldsCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  buttonContainer: {
    padding: spacing.sm,
    paddingBottom: spacing.md,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
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
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Picker styles
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    width: '85%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  pickerScroll: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pickerOptionWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerOptionText: {
    fontSize: 15,
  },
  pickerDivider: {
    height: 1,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  pickerSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  // Custom Date Picker styles
  datePickerContainer: {
    width: '90%',
    maxWidth: 360,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  calendarNavButton: {
    padding: spacing.sm,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  dayButton: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
  },
  quickDateActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  quickDateButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
  },
  quickDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
