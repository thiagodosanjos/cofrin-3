import { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    Pressable,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppTheme } from '../contexts/themeContext';
import { spacing, borderRadius } from '../theme';
import { Goal, Account } from '../types/firebase';
import { formatCurrencyBRL } from '../utils/format';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (amount: number, accountId: string) => Promise<void>;
  goal: Goal;
  progressPercentage: number;
  accounts: Account[];
}

export default function AddToGoalModal({ visible, onClose, onSave, goal, progressPercentage, accounts }: Props) {
  const { colors } = useAppTheme();
  
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const remaining = goal.targetAmount - goal.currentAmount;

  // Filtrar apenas contas com saldo positivo
  const availableAccounts = accounts.filter(acc => !acc.isArchived && acc.balance > 0);

  // Selecionar primeira conta com saldo ao abrir
  useEffect(() => {
    if (visible && availableAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(availableAccounts[0].id);
    }
  }, [visible, availableAccounts]);

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  const handleClose = () => {
    setAmount('');
    setSelectedAccountId(null);
    setError('');
    onClose();
  };

  const handleSave = async () => {
    const value = parseFloat(amount.replace(/[^\d,]/g, '').replace(',', '.'));
    
    if (isNaN(value) || value <= 0) {
      setError('Digite um valor válido');
      return;
    }

    if (!selectedAccountId) {
      setError('Selecione uma conta');
      return;
    }

    if (selectedAccount && value > selectedAccount.balance) {
      setError(`Saldo insuficiente. Disponível: ${formatCurrencyBRL(selectedAccount.balance)}`);
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onSave(value, selectedAccountId);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar valor');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    
    const numValue = parseInt(numbers, 10) / 100;
    return numValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountChange = (value: string) => {
    setAmount(formatCurrency(value));
  };

  // Sugestões rápidas de valores
  const suggestions = [50, 100, 200, 500].filter(v => v <= remaining + 100);

  // Verificar se meta está completa
  const isGoalComplete = goal.currentAmount >= goal.targetAmount;

  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.fullscreenModal, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.fullscreenHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fullscreenTitle, { color: colors.text }]}>Adicionar à meta</Text>
            <Pressable onPress={handleClose} hitSlop={8} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView 
            contentContainerStyle={[styles.modalBody, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Info da meta */}
            <View style={[styles.goalInfo, { backgroundColor: colors.card }]}>
            <View style={styles.goalHeader}>
              <MaterialCommunityIcons 
                name={(goal.icon as any) || 'flag-checkered'} 
                size={24} 
                color={colors.primary} 
              />
              <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
            </View>
            <View style={styles.goalProgress}>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min(progressPercentage, 100)}%`, backgroundColor: colors.primary }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {formatCurrencyBRL(goal.currentAmount)} de {formatCurrencyBRL(goal.targetAmount)}
              </Text>
            </View>
          </View>

          {/* Quanto falta */}
          <View style={[styles.remainingBox, { backgroundColor: isGoalComplete ? colors.successBg : colors.primaryBg }]}>
            <MaterialCommunityIcons 
              name={isGoalComplete ? "check-circle" : "flag-checkered"} 
              size={18} 
              color={isGoalComplete ? colors.success : colors.primary} 
            />
            <Text style={[styles.remainingText, { color: isGoalComplete ? colors.success : colors.primary }]}>
              {isGoalComplete 
                ? 'Parabéns! Você já atingiu sua meta!' 
                : `Faltam ${formatCurrencyBRL(remaining > 0 ? remaining : 0)} para alcançar sua meta!`
              }
            </Text>
          </View>

          {/* Seleção de conta */}
          <Text style={[styles.label, { color: colors.text }]}>De qual conta vai sair?</Text>
          {availableAccounts.length === 0 ? (
            <View style={[styles.noAccountsBox, { backgroundColor: colors.bg }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.noAccountsText, { color: colors.textMuted }]}>
                Nenhuma conta com saldo disponível
              </Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.accountsScroll}
              contentContainerStyle={styles.accountsList}
            >
              {availableAccounts.map((account) => {
                const isSelected = selectedAccountId === account.id;
                return (
                  <Pressable
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={[
                      styles.accountCard,
                      { 
                        backgroundColor: isSelected ? colors.primary : colors.bg,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }
                    ]}
                  >
                    <Text style={[
                      styles.accountName,
                      { color: isSelected ? '#fff' : colors.text }
                    ]} numberOfLines={1}>
                      {account.name}
                    </Text>
                    <Text style={[
                      styles.accountBalance,
                      { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textMuted }
                    ]}>
                      {formatCurrencyBRL(account.balance)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Input de valor - esconder se meta completa */}
          {!isGoalComplete && (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Quanto você conquistou?</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>R$</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  placeholder="0,00"
                  placeholderTextColor={colors.textMuted}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
            </>
          )}

          {/* Sugestões rápidas - esconder se meta completa */}
          {!isGoalComplete && suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setAmount(formatCurrency((value * 100).toString()))}
                  style={[styles.suggestionChip, { backgroundColor: colors.bg, borderColor: colors.border }]}
                >
                  <Text style={[styles.suggestionText, { color: colors.text }]}>
                    +R$ {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Erro */}
          {error ? (
            <Text style={[styles.errorText, { color: colors.expense }]}>{error}</Text>
          ) : null}

          {/* Botões */}
          <View style={styles.buttons}>
            <Pressable
              onPress={handleClose}
              style={[styles.cancelButton, { borderColor: colors.border }, isGoalComplete && { flex: 1 }]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                {isGoalComplete ? 'Fechar' : 'Cancelar'}
              </Text>
            </Pressable>
            
            {!isGoalComplete && (
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[
                  styles.saveButton, 
                  { backgroundColor: colors.primary },
                  saving && { opacity: 0.6 }
                ]}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {saving ? 'Salvando...' : 'Adicionar'}
                </Text>
              </Pressable>
            )}
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreenModal: {
    flex: 1,
    overflow: 'hidden',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  fullscreenTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: spacing.lg,
  },
  goalInfo: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  goalProgress: {
    gap: spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
  },
  remainingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  remainingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  noAccountsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  noAccountsText: {
    fontSize: 14,
  },
  accountsScroll: {
    marginBottom: spacing.md,
  },
  accountsList: {
    gap: spacing.sm,
  },
  accountCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 120,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountBalance: {
    fontSize: 13,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '500',
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: spacing.md,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
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
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
