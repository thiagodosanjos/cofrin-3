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
    TextInput
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Timestamp } from 'firebase/firestore';
import { useAppTheme } from '../../contexts/themeContext';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius, getShadow } from '../../theme';
import { useCategories } from '../../hooks/useCategories';
import { useAccounts } from '../../hooks/useAccounts';
import { useCreditCards } from '../../hooks/useCreditCards';
import { useTransactions } from '../../hooks/useFirebaseTransactions';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import CustomAlert from '../CustomAlert';
import { TransactionType, RecurrenceType, CreateTransactionInput } from '../../types/firebase';
import { useTransactionRefresh } from '../../contexts/transactionRefreshContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
type LocalTransactionType = 'despesa' | 'receita' | 'transfer';
type PickerType = 'none' | 'category' | 'account' | 'toAccount' | 'creditCard' | 'recurrence' | 'repetitions' | 'date';

export interface EditableTransaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  description: string;
  date: Date;
  categoryId?: string;
  categoryName?: string;
  accountId?: string;
  accountName?: string;
  toAccountId?: string;
  toAccountName?: string;
  creditCardId?: string;
  creditCardName?: string;
  recurrence?: RecurrenceType;
  seriesId?: string; // ID da série para transações recorrentes
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave?: () => void;
  onDelete?: (id: string) => void;
  onDeleteSeries?: (seriesId: string) => void;
  initialType?: LocalTransactionType;
  editTransaction?: EditableTransaction | null;
}

// Constants
const RECURRENCE_OPTIONS: { label: string; value: RecurrenceType }[] = [
  { label: 'Não repetir', value: 'none' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Quinzenal', value: 'biweekly' },
  { label: 'Mensal', value: 'monthly' },
  { label: 'Anual', value: 'yearly' },
];

// Opções de número de repetições (1-72)
const REPETITION_OPTIONS = Array.from({ length: 72 }, (_, i) => ({
  label: `${i + 1}x`,
  value: i + 1,
}));

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
  onDelete,
  onDeleteSeries,
  initialType = 'despesa',
  editTransaction,
}: Props) {
  const { colors } = useAppTheme();
  const { refreshKey } = useTransactionRefresh();

  // Firebase hooks
  const { categories, refresh: refreshCategories } = useCategories();
  const { activeAccounts, refresh: refreshAccounts } = useAccounts();
  const { activeCards, refresh: refreshCreditCards } = useCreditCards();
  const { createTransaction, updateTransaction } = useTransactions();
  const navigation = useNavigation<any>();

  // Mode
  const isEditMode = !!editTransaction;

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
  const [repetitions, setRepetitions] = useState(1); // Número de repetições (1-72)
  const [saving, setSaving] = useState(false);

  // Single picker state - evita modais aninhados
  const [activePicker, setActivePicker] = useState<PickerType>('none');
  
  // Date picker state for custom calendar
  const [tempDate, setTempDate] = useState(new Date());
  
  // Custom alert hook
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  
  // Calcular valor por parcela
  const installmentValue = React.useMemo(() => {
    if (recurrence !== 'none' && repetitions > 1) {
      const parsed = parseCurrency(amount);
      return parsed / repetitions;
    }
    return 0;
  }, [amount, repetitions, recurrence]);
  
  // Obter conta de origem e verificar saldo
  const sourceAccount = React.useMemo(() => {
    if (type === 'transfer' || (type === 'despesa' && !useCreditCard)) {
      return activeAccounts.find(acc => acc.id === accountId);
    }
    return null;
  }, [type, accountId, useCreditCard, activeAccounts]);
  
  // Verificar se pode confirmar (saldo suficiente para transferência)
  const canConfirm = React.useMemo(() => {
    if (type === 'transfer') {
      // Não permitir transferência para a mesma conta
      if (accountId && toAccountId && accountId === toAccountId) {
        return false;
      }
      // Verificar saldo suficiente
      if (sourceAccount) {
        const parsed = parseCurrency(amount);
        return sourceAccount.balance >= 0 && sourceAccount.balance >= parsed;
      }
    }
    return true;
  }, [type, sourceAccount, amount, accountId, toAccountId]);

  // Limpar categoria quando mudar para transferência
  useEffect(() => {
    if (type === 'transfer') {
      setCategoryId('');
      setCategoryName('');
    }
  }, [type]);

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

  // Reset form when modal opens or populate with edit data
  useEffect(() => {
    if (visible) {
      // Recarregar listas quando abrir (corrige UI desatualizada após criar/editar/excluir)
      refreshCategories();
      refreshAccounts();
      refreshCreditCards();

      setActivePicker('none');
      setSaving(false);
      
      if (editTransaction) {
        // Populate form with existing transaction data
        const localType: LocalTransactionType = 
          editTransaction.type === 'expense' ? 'despesa' : 
          editTransaction.type === 'income' ? 'receita' : 'transfer';
        setType(localType);
        
        // Format amount for display
        const cents = Math.round(editTransaction.amount * 100);
        setAmount(formatCurrency(cents.toString()));
        
        setDescription(editTransaction.description || '');
        setDate(editTransaction.date);
        setRecurrence(editTransaction.recurrence || 'none');
        setRepetitions(1); // Em edição, não alteramos repetições
        
        // Category
        if (editTransaction.categoryId) {
          setCategoryId(editTransaction.categoryId);
          setCategoryName(editTransaction.categoryName || '');
        }
        
        // Account
        if (editTransaction.accountId) {
          setAccountId(editTransaction.accountId);
          setAccountName(editTransaction.accountName || '');
          setUseCreditCard(false);
        } else if (editTransaction.creditCardId) {
          setUseCreditCard(true);
          setCreditCardId(editTransaction.creditCardId);
          setCreditCardName(editTransaction.creditCardName || '');
        }
        
        // To account (for transfers)
        if (editTransaction.toAccountId) {
          setToAccountId(editTransaction.toAccountId);
          setToAccountName(editTransaction.toAccountName || '');
        }
      } else {
        // Reset to defaults for new transaction
        setType(initialType);
        setAmount('R$ 0,00');
        setDescription('');
        setDate(new Date());
        setRecurrence('none');
        setRepetitions(1);
        setUseCreditCard(false);
        setCreditCardId('');
        setCreditCardName('');
        
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
    }
  }, [visible, initialType, editTransaction, refreshCategories, refreshAccounts, refreshCreditCards, refreshKey]); // Removido activeAccounts e categories

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
      showAlert('Erro', 'O valor deve ser maior que zero', [{ text: 'OK', style: 'default' }]);
      return;
    }

    if (!accountId && !useCreditCard) {
      showAlert('Erro', 'Selecione uma conta', [{ text: 'OK', style: 'default' }]);
      return;
    }

    if (type === 'transfer' && !toAccountId) {
      showAlert('Erro', 'Selecione a conta de destino', [{ text: 'OK', style: 'default' }]);
      return;
    }

    // Validar saldo para transferências e despesas (quando não usar cartão de crédito)
    if ((type === 'transfer' || (type === 'despesa' && !useCreditCard)) && accountId) {
      const sourceAccount = activeAccounts.find(a => a.id === accountId);
      if (sourceAccount && sourceAccount.balance < parsed) {
        showAlert(
          'Saldo insuficiente', 
          `Você não tem saldo suficiente na conta "${sourceAccount.name}".\n\nSaldo disponível: R$ ${sourceAccount.balance.toFixed(2).replace('.', ',')}\nValor da ${type === 'transfer' ? 'transferência' : 'despesa'}: R$ ${parsed.toFixed(2).replace('.', ',')}`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
    }

    setSaving(true);
    try {
      // Map local type to Firebase type
      const firebaseType: TransactionType = 
        type === 'despesa' ? 'expense' : 
        type === 'receita' ? 'income' : 'transfer';

      // Função para calcular próxima data baseado na recorrência
      const getNextDate = (baseDate: Date, occurrence: number): Date => {
        const newDate = new Date(baseDate);
        switch (recurrence) {
          case 'weekly':
            newDate.setDate(newDate.getDate() + (7 * occurrence));
            break;
          case 'biweekly':
            newDate.setDate(newDate.getDate() + (14 * occurrence));
            break;
          case 'monthly':
            newDate.setMonth(newDate.getMonth() + occurrence);
            break;
          case 'yearly':
            newDate.setFullYear(newDate.getFullYear() + occurrence);
            break;
          default:
            break;
        }
        return newDate;
      };

      // Gerar seriesId único para transações em série
      const seriesId = recurrence !== 'none' && repetitions > 1 
        ? `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : undefined;

      // Build base transaction data without undefined fields
      const buildTransactionData = (transactionDate: Date): CreateTransactionInput => {
        // Status baseado na data: futuro = pendente, passado/hoje = concluído
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const txDate = new Date(transactionDate);
        txDate.setHours(0, 0, 0, 0);
        const transactionStatus = txDate > today ? 'pending' : 'completed';

        const data: CreateTransactionInput = {
          type: firebaseType,
          amount: parsed,
          description: description.trim() || categoryName,
          date: Timestamp.fromDate(transactionDate),
          recurrence,
          status: transactionStatus,
        };

        // Adicionar accountId apenas se não for cartão de crédito ou se não for despesa com cartão
        if (!(useCreditCard && type === 'despesa') && accountId) {
          data.accountId = accountId;
        }

        // Add optional fields only if they have values
        if (type !== 'transfer' && categoryId) {
          data.categoryId = categoryId;
        }
        if (type === 'transfer' && toAccountId) {
          data.toAccountId = toAccountId;
        }
        if (useCreditCard && type === 'despesa' && creditCardId) {
          data.creditCardId = creditCardId;
        }
        // Add seriesId for recurring transactions
        if (seriesId) {
          data.seriesId = seriesId;
        }

        return data;
      };

      let success = false;
      
      if (isEditMode && editTransaction) {
        // Update existing transaction (não cria repetições na edição)
        const transactionData = buildTransactionData(date);
        success = await updateTransaction(editTransaction.id, transactionData);
        if (success) {
          showAlert('Sucesso', 'Lançamento atualizado!', [{ text: 'OK', style: 'default' }]);
        }
      } else {
        // Create new transaction(s)
        const totalToCreate = recurrence === 'none' ? 1 : repetitions;
        let createdCount = 0;

        for (let i = 0; i < totalToCreate; i++) {
          const transactionDate = getNextDate(date, i);
          const transactionData = buildTransactionData(transactionDate);
          const result = await createTransaction(transactionData);
          if (result) {
            createdCount++;
          }
        }

        success = createdCount === totalToCreate;
        if (success) {
          if (totalToCreate > 1) {
            const valuePerInstallment = formatCurrency(Math.round((parsed / totalToCreate) * 100).toString());
            showAlert('Sucesso', `${createdCount} lançamentos criados!\n${totalToCreate}x de ${valuePerInstallment}`, [{ text: 'OK', style: 'default' }]);
          } else {
            showAlert('Sucesso', 'Lançamento salvo!', [{ text: 'OK', style: 'default' }]);
          }
        } else if (createdCount > 0) {
          showAlert('Aviso', `Apenas ${createdCount} de ${totalToCreate} lançamentos foram criados.`, [{ text: 'OK', style: 'default' }]);
          success = true; // Considerar parcialmente bem sucedido
        }
      }

      if (success) {
        onSave?.();
        onClose();
      } else {
        showAlert('Erro', `Não foi possível ${isEditMode ? 'atualizar' : 'salvar'} o lançamento`, [{ text: 'OK', style: 'default' }]);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showAlert('Erro', 'Ocorreu um erro ao salvar', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }, [
    type, amount, description, categoryId, categoryName,
    accountId, toAccountId, creditCardId, useCreditCard,
    date, recurrence, repetitions, createTransaction, updateTransaction, 
    isEditMode, editTransaction, onSave, onClose, activeAccounts
  ]);

  // Componente de campo selecionável
  const SelectField = ({
    label,
    value,
    icon,
    onPress,
    subtitle,
    subtitleColor,
  }: {
    label: string;
    value: string;
    icon: string;
    onPress: () => void;
    subtitle?: string;
    subtitleColor?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectField,
        { backgroundColor: pressed ? colors.grayLight : 'transparent' },
      ]}
    >
      <View style={[styles.fieldIcon, { backgroundColor: colors.grayLight }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.gray} />
      </View>
      <View style={styles.fieldContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
          {subtitle && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>|</Text>
              <Text style={[styles.fieldSubtitle, { color: subtitleColor || colors.textMuted }]}>{subtitle}</Text>
            </>
          )}
        </View>
        <Text style={[styles.fieldValue, { color: colors.text }]}>{value}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray} />
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
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.gray} />
          </Pressable>
          <Text style={[styles.calendarTitle, { color: colors.text }]}>
            {MONTHS[month]} {year}
          </Text>
          <Pressable onPress={goToNextMonth} style={styles.calendarNavButton}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.gray} />
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
                  // Se escolher "Não repetir", reseta repetições para 1
                  if (option.value === 'none') {
                    setRepetitions(1);
                  }
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

    // Render repetitions picker
    if (activePicker === 'repetitions') {
      return (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Quantas vezes repetir?</Text>
            <Pressable onPress={() => setActivePicker('none')} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
            {REPETITION_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setRepetitions(option.value);
                  setActivePicker('none');
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  { backgroundColor: pressed ? colors.grayLight : 'transparent' },
                  repetitions === option.value && { backgroundColor: colors.primaryBg },
                ]}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    { color: colors.text },
                    repetitions === option.value && { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  {option.label}
                </Text>
                {repetitions === option.value && (
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
    <>
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
                    {isEditMode 
                      ? (type === 'despesa' ? 'Editar Despesa' : type === 'receita' ? 'Editar Receita' : 'Editar Transferência')
                      : (type === 'despesa' ? 'Nova Despesa' : type === 'receita' ? 'Nova Receita' : 'Nova Transferência')
                    }
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
                        disabled={activeAccounts.length === 0}
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
                    editable={activeAccounts.length > 0}
                  />
                </View>
                {/* Onboarding message if no accounts */}
                {activeAccounts.length === 0 ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                    <MaterialCommunityIcons name="account-plus" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
                    <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 12 }}>
                      Bem-vindo ao Cofrin!
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 24 }}>
                      Verificamos que você não tem conta cadastrada e para iniciar os lançamentos isso é importante. Por favor, cadastre sua primeira conta para começar a usar o Cofrin.
                    </Text>
                    <Pressable
                      onPress={() => {
                        onClose();
                        navigation.navigate('ConfigureAccounts');
                      }}
                      style={({ pressed }) => [
                        styles.onboardingButton,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                      ]}
                    >
                      <MaterialCommunityIcons name="arrow-left" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.onboardingButtonText}>Cadastrar Conta</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{flex: 1}}>
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
                          subtitle={sourceAccount ? `Saldo atual: ${formatCurrency(Math.round(sourceAccount.balance * 100).toString())}` : undefined}
                          subtitleColor={sourceAccount && sourceAccount.balance < 0 ? colors.danger : colors.textMuted}
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
                    {/* Número de repetições - só aparece se recorrência != none */}
                    {recurrence !== 'none' && (
                      <>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SelectField
                          label="Quantas vezes?"
                          value={`${repetitions}x`}
                          icon="counter"
                          onPress={() => setActivePicker('repetitions')}
                        />
                        {/* Informação do valor por parcela */}
                        {repetitions > 1 && installmentValue > 0 && (
                          <View style={[styles.installmentInfo, { backgroundColor: colors.primaryBg }]}>
                            <MaterialCommunityIcons name="information" size={16} color={colors.primary} />
                            <Text style={[styles.installmentText, { color: colors.primary }]}>
                              {repetitions}x de {formatCurrency(Math.round(installmentValue * 100).toString())}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </ScrollView>
                {/* Aviso: mesma conta - antes dos botões */}
                {type === 'transfer' && accountId && toAccountId && accountId === toAccountId && (
                  <View style={[styles.warningInfo, { backgroundColor: colors.warningBg, marginHorizontal: spacing.md }]}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color={colors.warning} />
                    <Text style={[styles.warningText, { color: colors.warning }]}>
                      Não é possível transferir para a mesma conta
                    </Text>
                  </View>
                )}
                {/* Botões - fixo no fundo */}
                <View style={[styles.buttonContainer, { backgroundColor: colors.bg }]}>
                  {/* Botão Excluir - só aparece em modo edição */}
                  {isEditMode && onDelete && editTransaction && (
                    <Pressable
                      onPress={() => {
                        // Verificar se faz parte de uma série
                        if (editTransaction.seriesId && onDeleteSeries) {
                          showAlert(
                            'Excluir lançamento',
                            'Este lançamento faz parte de uma série. O que deseja fazer?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { 
                                text: 'Excluir apenas este', 
                                onPress: () => {
                                  onDelete(editTransaction.id);
                                  onClose();
                                }
                              },
                              { 
                                text: 'Excluir toda a série', 
                                style: 'destructive',
                                onPress: () => {
                                  onDeleteSeries(editTransaction.seriesId!);
                                  onClose();
                                }
                              },
                            ]
                          );
                        } else {
                          // Transação única - confirmar normalmente
                          showAlert(
                            'Excluir lançamento',
                            'Tem certeza que deseja excluir este lançamento?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { 
                                text: 'Excluir', 
                                style: 'destructive',
                                onPress: () => {
                                  onDelete(editTransaction.id);
                                  onClose();
                                }
                              },
                            ]
                          );
                        }
                      }}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        { borderColor: '#dc2626' },
                        pressed && { opacity: 0.8, backgroundColor: '#dc262610' },
                      ]}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#dc2626" />
                      <Text style={styles.deleteButtonText}>Excluir</Text>
                    </Pressable>
                  )}
                  {/* Botão Salvar/Atualizar - sempre verde */}
                  <Pressable
                    onPress={handleSave}
                    disabled={saving || !canConfirm}
                    style={({ pressed }) => [
                      styles.saveButton,
                      { backgroundColor: '#10b981' },
                      pressed && { opacity: 0.9 },
                      (saving || !canConfirm) && { opacity: 0.6 },
                    ]}
                  >
                    <MaterialCommunityIcons name={saving ? 'loading' : 'check'} size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      {saving ? (isEditMode ? 'Atualizando...' : 'Salvando...') : (isEditMode ? 'Atualizar' : 'Confirmar')}
                    </Text>
                  </Pressable>
                </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
      
      {/* Custom Alert */}
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </>
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
  fieldSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginLeft: 68,
    backgroundColor: '#e2e8f0',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  saveButton: {
    flex: 1,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: spacing.xs,
  },
  onboardingButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  onboardingButtonText: {
    fontSize: 15,
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
  installmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  installmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  accountBalanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  accountBalanceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  warningInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  warningText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
