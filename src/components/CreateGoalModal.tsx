import { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    Pressable,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAppTheme } from '../contexts/themeContext';
import { spacing, borderRadius } from '../theme';
import { Goal, GOAL_ICONS, GOAL_ICON_LABELS } from '../types/firebase';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    targetAmount: number;
    targetDate: Date;
    icon: string;
  }) => Promise<void>;
  onDelete?: (confirmed: boolean) => Promise<void>;
  existingGoal?: Goal | null;
  progressPercentage?: number;
  showSetPrimaryOption?: boolean; // Mostrar opção para definir como principal
  onSaveAsPrimary?: (data: {
    name: string;
    targetAmount: number;
    targetDate: Date;
    icon: string;
  }) => Promise<void>; // Callback para salvar como principal
}

export default function CreateGoalModal({ 
  visible, 
  onClose, 
  onSave, 
  onDelete, 
  existingGoal, 
  progressPercentage = 0,
  showSetPrimaryOption = false,
  onSaveAsPrimary
}: Props) {
  const { colors } = useAppTheme();
  
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [icon, setIcon] = useState('cash-multiple');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Preencher com dados existentes se estiver editando
  useEffect(() => {
    if (existingGoal) {
      setName(existingGoal.name);
      setTargetAmount(existingGoal.targetAmount.toString());
      // Se tem targetDate, usar; senão calcular com base no timeframe (legado)
      if (existingGoal.targetDate) {
        setTargetDate(existingGoal.targetDate.toDate());
      } else {
        // Fallback: adicionar meses baseado no timeframe
        const now = new Date();
        const months = existingGoal.timeframe === 'short' ? 12 : existingGoal.timeframe === 'medium' ? 36 : 60;
        now.setMonth(now.getMonth() + months);
        setTargetDate(now);
      }
      setIcon(existingGoal.icon || 'cash-multiple');
    } else {
      // Reset para nova meta
      setName('');
      setTargetAmount('');
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 12); // 1 ano por padrão
      setTargetDate(defaultDate);
      setIcon('cash-multiple');
    }
    setError('');
  }, [existingGoal, visible]);

  const handleSave = async () => {
    // Validações
    if (!name.trim()) {
      setError('Digite o nome da sua meta');
      return;
    }

    const amount = parseFloat(targetAmount.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setError('Digite um valor válido para a meta');
      return;
    }

    // Validar data no futuro
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(targetDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate <= today) {
      setError('A data da meta deve ser no futuro');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSave({
        name: name.trim(),
        targetAmount: amount,
        targetDate,
        icon,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar meta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !existingGoal) return;
    
    // Mostrar confirmação com progresso
    const progress = Math.round(progressPercentage);
    const message = progress > 0 
      ? `Tem certeza que quer excluir sua meta?\n\nVocê já tem ${progress}% de progresso (R$ ${existingGoal.currentAmount.toFixed(2)} de R$ ${existingGoal.targetAmount.toFixed(2)}).`
      : `Tem certeza que quer excluir sua meta?\n\nEsta ação não pode ser desfeita.`;
    
    Alert.alert(
      'Excluir meta',
      message,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              setError('');
              await onDelete(true);
              onClose();
            } catch (err: any) {
              setError(err.message || 'Erro ao excluir meta');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: string) => {
    // Remove tudo exceto números
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    
    // Converte para número e formata
    const amount = parseInt(numbers, 10) / 100;
    return amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountChange = (value: string) => {
    setTargetAmount(formatCurrency(value));
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setTargetDate(selectedDate);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {existingGoal ? 'Editar meta' : 'Criar meta'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Texto motivacional */}
            <View style={[styles.motivationalBox, { backgroundColor: colors.primaryBg }]}>
              <MaterialCommunityIcons name="lightbulb-on" size={20} color={colors.primary} />
              <Text style={[styles.motivationalText, { color: colors.primary }]}>
                Uma meta clara transforma sonhos em planos concretos.
              </Text>
            </View>

            {/* Nome da meta */}
            <Text style={[styles.label, { color: colors.text }]}>Qual é sua meta?</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              placeholder="Ex: Comprar um carro, Viagem, Reserva..."
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={50}
            />

            {/* Valor da meta */}
            <Text style={[styles.label, { color: colors.text }]}>Quanto você precisa?</Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>R$</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                placeholder="0,00"
                placeholderTextColor={colors.textMuted}
                value={targetAmount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
              />
            </View>

            {/* Data de finalização */}
            <Text style={[styles.label, { color: colors.text }]}>Quando você quer atingir?</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[styles.dateButton, { backgroundColor: colors.bg, borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name="calendar" size={20} color={colors.primary} />
              <Text style={[styles.dateText, { color: colors.text }]}>
                {formatDate(targetDate)}
              </Text>
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={targetDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {/* Ícone */}
            <Text style={[styles.label, { color: colors.text }]}>Escolha uma categoria</Text>
            <View style={styles.iconGrid}>
              {GOAL_ICONS.map((iconName) => {
                const isSelected = icon === iconName;
                const label = GOAL_ICON_LABELS[iconName] || iconName;
                return (
                  <Pressable
                    key={iconName}
                    onPress={() => setIcon(iconName)}
                    style={[
                      styles.iconOptionLarge,
                      { 
                        backgroundColor: isSelected ? colors.primary : colors.bg,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }
                    ]}
                  >
                    <MaterialCommunityIcons 
                      name={iconName as any} 
                      size={32} 
                      color={isSelected ? '#fff' : colors.text} 
                    />
                    <Text style={[
                      styles.iconLabel,
                      { color: isSelected ? '#fff' : colors.text }
                    ]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Erro */}
            {error ? (
              <Text style={[styles.errorText, { color: colors.expense }]}>{error}</Text>
            ) : null}

            {/* Botão de excluir (só aparece ao editar) */}
            {existingGoal && onDelete && (
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={[
                  styles.deleteButton,
                  { borderColor: colors.expense },
                  deleting && { opacity: 0.6 }
                ]}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.expense} />
                <Text style={[styles.deleteButtonText, { color: colors.expense }]}>
                  {deleting ? 'Excluindo...' : 'Excluir meta'}
                </Text>
              </Pressable>
            )}

            {/* Botões */}
            <View style={styles.buttons}>
              <Pressable
                onPress={onClose}
                style={[styles.cancelButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
              
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[
                  styles.saveButton, 
                  { backgroundColor: colors.primary },
                  saving && { opacity: 0.6 }
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Salvando...' : existingGoal ? 'Salvar' : 'Criar meta'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  motivationalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  motivationalText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  iconGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  iconOptionLarge: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  iconLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeframeOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeframeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  timeframeLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeframeDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    marginTop: spacing.lg,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
