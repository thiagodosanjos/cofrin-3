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
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DatePickerCrossPlatform from './DatePickerCrossPlatform';
import CustomAlert from './CustomAlert';

import { useAppTheme } from '../contexts/themeContext';
import { spacing, borderRadius } from '../theme';
import { Goal, GOAL_ICONS, GOAL_ICON_LABELS } from '../types/firebase';
import { getModalContainerStyle } from '../utils/modalLayout';

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
  const [icon, setIcon] = useState('piggy-bank');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  // Função para formatar número para moeda brasileira
  const formatNumberToCurrency = (num: number): string => {
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Preencher com dados existentes se estiver editando
  useEffect(() => {
    if (existingGoal) {
      setName(existingGoal.name);
      // Formatar o valor corretamente para exibição
      setTargetAmount(formatNumberToCurrency(existingGoal.targetAmount));
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
      setIcon(existingGoal.icon || 'piggy-bank');
    } else {
      // Reset para nova meta
      setName('');
      setTargetAmount('');
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 12); // 1 ano por padrão
      setTargetDate(defaultDate);
      setIcon('piggy-bank');
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
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (!onDelete || !existingGoal) return;
    
    try {
      setDeleting(true);
      setError('');
      setShowDeleteAlert(false);
      await onDelete(true);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir meta');
    } finally {
      setDeleting(false);
    }
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
        
        <View style={Platform.OS === 'web' ? { alignItems: 'center', width: '100%' } : undefined}>
        <View style={[getModalContainerStyle(colors), { backgroundColor: colors.card }]}> 
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {existingGoal ? 'Editar meta' : 'Criar meta'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
              </Pressable>
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
            <DatePickerCrossPlatform
              label="Quando você quer atingir?"
              value={targetDate}
              onChange={setTargetDate}
              minimumDate={new Date()}
            />

            {/* Ícone */}
            <Text style={[styles.label, { color: colors.text }]}>Escolha uma categoria</Text>
            <View style={styles.chipGrid}>
              {GOAL_ICONS.map((iconName) => {
                const isSelected = icon === iconName;
                const label = GOAL_ICON_LABELS[iconName] || iconName;
                return (
                  <Pressable
                    key={iconName}
                    onPress={() => setIcon(iconName)}
                    style={[
                      styles.chip,
                      { 
                        backgroundColor: isSelected ? colors.primary : colors.bg,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }
                    ]}
                  >
                    <Text style={[
                      styles.chipText,
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
        </View>
      </KeyboardAvoidingView>

      {/* Alert de confirmação de exclusão */}
      <CustomAlert
        visible={showDeleteAlert}
        title="Excluir meta"
        message={
          existingGoal && progressPercentage > 0
            ? `Tem certeza que quer excluir sua meta?\n\nVocê já tem ${Math.round(progressPercentage)}% de progresso (R$ ${existingGoal.currentAmount.toFixed(2)} de R$ ${existingGoal.targetAmount.toFixed(2)}).`
            : 'Tem certeza que quer excluir sua meta?\n\nEsta ação não pode ser desfeita.'
        }
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: confirmDelete },
        ]}
        onClose={() => setShowDeleteAlert(false)}
      />
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
  centeredContainer: {
    width: '100%',
    alignSelf: 'center',
    marginTop: 'auto',
  },
  container: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
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
