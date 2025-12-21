import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/themeContext";
import { useAuth } from "../contexts/authContext";
import { spacing, borderRadius, getShadow } from "../theme";
import { useAccounts } from "../hooks/useAccounts";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { useSnackbar } from "../hooks/useSnackbar";
import CustomAlert from "../components/CustomAlert";
import Snackbar from "../components/Snackbar";
import LoadingOverlay from "../components/LoadingOverlay";
import MainLayout from "../components/MainLayout";
import SimpleHeader from "../components/SimpleHeader";
import { AccountType, ACCOUNT_TYPE_LABELS, Account } from "../types/firebase";
import { formatCurrencyBRL } from "../utils/format";
import { deleteTransactionsByAccount, countTransactionsByAccount } from "../services/transactionService";
import * as transactionService from "../services/transactionService";
import { setAccountBalance } from "../services/accountService";
import { useTransactionRefresh } from "../contexts/transactionRefreshContext";

interface AccountTypeOption {
  id: AccountType;
  icon: string;
  label: string;
}

const ACCOUNT_TYPES: AccountTypeOption[] = [
  { id: 'checking', icon: 'bank', label: 'Corrente' },
  { id: 'wallet', icon: 'wallet', label: 'Carteira' },
  { id: 'investment', icon: 'chart-line', label: 'Investimento' },
  { id: 'other', icon: 'dots-horizontal', label: 'Outro' },
];

const ACCOUNT_ICONS = [
  'bank', 'piggy-bank', 'wallet',
  'cash','chart-line', 'bitcoin',
];

export default function ConfigureAccounts({ navigation }: any) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const { snackbarState, showSnackbar, hideSnackbar } = useSnackbar();
  const { triggerRefresh } = useTransactionRefresh();
  const insets = useSafeAreaInsets();
  
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<AccountType>('checking');
  const [selectedIcon, setSelectedIcon] = useState('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [includeInTotal, setIncludeInTotal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [adjustBalanceValue, setAdjustBalanceValue] = useState('');
  const [adjustBalanceModalVisible, setAdjustBalanceModalVisible] = useState(false);
  
  // Estado para loading overlay (operações longas)
  const [loadingOverlay, setLoadingOverlay] = useState({
    visible: false,
    message: '',
    progress: null as { current: number; total: number } | null,
  });

  // Estado para modal de edição
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('checking');
  const [editIcon, setEditIcon] = useState('bank');

  // Hook de contas do Firebase
  const { 
    activeAccounts,
    totalBalance,
    loading, 
    createAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
    recalculateBalance,
  } = useAccounts();

  // Converter string de valor para número
  function parseBalance(value: string): number {
    // Remove tudo exceto dígitos, vírgula e ponto
    let cleaned = value.replace(/[^\d,.]/g, '');
    // Remove pontos (separador de milhares) e substitui vírgula por ponto (separador decimal)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  // Formatar valor monetário para exibição
  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    
    const numValue = parseInt(numbers, 10) / 100;
    return numValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  async function handleCreate() {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      const balance = parseBalance(initialBalance);
      
      const result = await createAccount({
        name: name.trim(),
        type: selectedType,
        icon: selectedIcon,
        initialBalance: balance,
        includeInTotal,
        isArchived: false,
      });

      if (result) {
        setName('');
        setInitialBalance('');
        setSelectedType('checking');
        setSelectedIcon('bank');
        setIncludeInTotal(true);
        triggerRefresh();
        showSnackbar('Conta criada com sucesso!');
      } else {
        showAlert('Erro', 'Não foi possível criar a conta', [{ text: 'OK', style: 'default' }]);
      }
    } catch (error) {
      showAlert('Erro', 'Ocorreu um erro ao criar a conta', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }

  // Abrir modal de edição
  function openEditModal(account: Account) {
    setEditingAccount(account);
    setEditName(account.name);
    setEditType(account.type);
    setEditIcon(account.icon || getAccountIcon(account.type));
    setEditModalVisible(true);
  }

  // Salvar edição
  async function handleSaveEdit() {
    if (!editingAccount || !editName.trim()) return;

    setSaving(true);
    try {
      const result = await updateAccount(editingAccount.id, {
        name: editName.trim(),
        type: editType,
        icon: editIcon,
      });

      if (result) {
        setEditModalVisible(false);
        setEditingAccount(null);
        triggerRefresh();
        showSnackbar('Conta atualizada!');
      } else {
        showAlert('Erro', 'Não foi possível atualizar a conta', [{ text: 'OK', style: 'default' }]);
      }
    } catch (error) {
      showAlert('Erro', 'Ocorreu um erro ao atualizar a conta', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }

  // Ajustar saldo da conta (cria transação de ajuste)
  async function handleAdjustBalance() {
    if (!editingAccount) return;
    setAdjustBalanceValue(editingAccount.balance.toFixed(2).replace('.', ','));
    setAdjustBalanceModalVisible(true);
  }

  // Recalcular saldo da conta com base nas transações reais
  async function handleRecalculateBalance() {
    if (!editingAccount || !user?.uid) return;
    
    const currentBalance = editingAccount.balance;
    
    showAlert(
      'Recalcular saldo?',
      `Esta ação irá recalcular o saldo da conta com base em todos os lançamentos marcados como "concluídos".\n\nSaldo atual: ${formatCurrencyBRL(currentBalance)}\n\nDeseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Recalcular', 
          style: 'default',
          onPress: performRecalculate 
        }
      ]
    );
  }

  async function performRecalculate() {
    if (!editingAccount || !user?.uid) return;
    
    setSaving(true);
    try {
      const oldBalance = editingAccount.balance;
      const newBalance = await recalculateBalance(editingAccount.id);
      
      if (newBalance === null) {
        showAlert('Erro', 'Não foi possível recalcular o saldo', [{ text: 'OK', style: 'default' }]);
        return;
      }
      
      const difference = newBalance - oldBalance;
      
      // Fechar modal e limpar estado
      setEditModalVisible(false);
      setEditingAccount(null);
      
      // Notificar refresh para atualizar toda a UI
      triggerRefresh();
      
      if (Math.abs(difference) < 0.01) {
        showAlert(
          'Saldo correto!',
          `O saldo estava correto:\n${formatCurrencyBRL(newBalance)}`,
          [{ text: 'OK', style: 'default' }]
        );
      } else {
        const changeType = difference > 0 ? 'aumentou' : 'diminuiu';
        showAlert(
          'Saldo recalculado',
          `O saldo ${changeType} ${formatCurrencyBRL(Math.abs(difference))}.\n\nSaldo anterior: ${formatCurrencyBRL(oldBalance)}\nNovo saldo: ${formatCurrencyBRL(newBalance)}`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (err) {
      console.error('Erro ao recalcular saldo:', err);
      showAlert('Erro', 'Ocorreu um erro ao recalcular o saldo', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }

  async function performBalanceAdjustment() {
    if (!editingAccount || !user?.uid) return;
    
    const newBalance = parseBalance(adjustBalanceValue);
    const currentBalance = editingAccount.balance;
    const difference = newBalance - currentBalance;
    
    if (difference === 0) {
      showAlert('Aviso', 'O saldo informado é igual ao saldo atual.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    setAdjustBalanceModalVisible(false);
    setSaving(true);
    try {
      // Criar transação de ajuste
      await transactionService.createBalanceAdjustment(
        user.uid,
        editingAccount.id,
        editingAccount.name,
        currentBalance,
        newBalance
      );
      
      // Atualizar o saldo da conta
      await setAccountBalance(editingAccount.id, newBalance);
      
      // Fechar modais e limpar estado
      setEditModalVisible(false);
      setEditingAccount(null);
      
      // Notificar refresh para atualizar toda a UI
      triggerRefresh();
      
      const adjustType = difference > 0 ? 'Crédito' : 'Débito';
      showAlert(
        'Saldo ajustado', 
        `${adjustType} de ${formatCurrencyBRL(Math.abs(difference))} aplicado.\n\nNovo saldo: ${formatCurrencyBRL(newBalance)}`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (err) {
      showAlert('Erro', 'Ocorreu um erro ao ajustar o saldo', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }

  // Resetar conta (deletar todas as transações)
  async function handleResetAccount() {
    if (!editingAccount || !user?.uid) return;
    
    // Primeiro, contar quantas transações existem
    const count = await countTransactionsByAccount(user.uid, editingAccount.id);
    const currentBalance = editingAccount.balance || 0;
    
    // Verificar se há algo para resetar
    if (count === 0 && currentBalance === 0) {
      showAlert('Aviso', 'Esta conta já está zerada (sem lançamentos e sem saldo).', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    // Mensagem de confirmação dinâmica
    let message = 'Esta ação irá ';
    if (count > 0) {
      message += `excluir ${count} lançamento${count > 1 ? 's' : ''} desta conta`;
    }
    if (currentBalance !== 0) {
      if (count > 0) message += ' e ';
      message += 'zerar o saldo';
    }
    message += '. Esta ação NÃO pode ser desfeita!';
    
    showAlert(
      'Resetar conta?',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Resetar', 
          style: 'destructive',
          onPress: async () => {
            // Fechar o modal de edição primeiro
            setEditModalVisible(false);
            
            // Mostrar loading overlay com progresso para operações longas
            setLoadingOverlay({
              visible: true,
              message: 'Excluindo lançamentos...',
              progress: count > 0 ? { current: 0, total: count } : null,
            });
            
            try {
              let deleted = 0;
              
              // Deletar todas as transações se houver
              if (count > 0) {
                const result = await deleteTransactionsByAccount(
                  user.uid, 
                  editingAccount.id,
                  // Callback de progresso para atualizar a UI
                  (current, total) => {
                    setLoadingOverlay(prev => ({
                      ...prev,
                      progress: { current, total },
                    }));
                  }
                );
                
                if (result.error) {
                  setLoadingOverlay({ visible: false, message: '', progress: null });
                  showAlert('Erro', result.error, [{ text: 'OK', style: 'default' }]);
                  return;
                }
                
                deleted = result.deleted;
              }
              
              // Atualizar mensagem para próxima etapa
              setLoadingOverlay(prev => ({
                ...prev,
                message: 'Zerando saldo...',
                progress: null,
              }));
              
              // Zerar o saldo da conta (sempre)
              await setAccountBalance(editingAccount.id, 0);
              
              // Atualizar a conta local para refletir o saldo zerado
              await updateAccount(editingAccount.id, { balance: 0 });

              // Notificar outras telas (Home/Lançamentos) para recarregar dados
              // Importante: Fazer refresh ANTES de esconder o loading
              setLoadingOverlay(prev => ({
                ...prev,
                message: 'Atualizando...',
              }));
              
              triggerRefresh();
              
              // Aguardar um pouco para garantir que o refresh foi processado
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Esconder loading overlay
              setLoadingOverlay({ visible: false, message: '', progress: null });
              
              // Limpar estado do modal
              setEditingAccount(null);
              
              // Mensagem de sucesso dinâmica
              let successMessage = '';
              if (deleted > 0) {
                successMessage = `${deleted} lançamento${deleted > 1 ? 's' : ''} excluído${deleted > 1 ? 's' : ''}. `;
              }
              successMessage += 'Saldo zerado.';
              
              showSnackbar(successMessage);
            } catch (err) {
              setLoadingOverlay({ visible: false, message: '', progress: null });
              showAlert('Erro', 'Ocorreu um erro ao resetar a conta', [{ text: 'OK', style: 'default' }]);
            }
          }
        },
      ]
    );
  }

  // Arquivar conta do modal
  async function handleArchiveFromModal() {
    if (!editingAccount) return;
    
    showAlert(
      'Arquivar conta?',
      `A conta "${editingAccount.name}" será arquivada e não aparecerá mais na lista.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Arquivar', 
          onPress: async () => {
            const result = await archiveAccount(editingAccount.id);
            if (result) {
              setEditModalVisible(false);
              setEditingAccount(null);
              triggerRefresh();
            } else {
              showAlert('Erro', 'Não foi possível arquivar a conta', [{ text: 'OK', style: 'default' }]);
            }
          }
        },
      ]
    );
  }

  // Excluir conta do modal
  async function handleDeleteFromModal() {
    if (!editingAccount) return;
    
    // Bloquear exclusão da conta padrão
    if (editingAccount.isDefault) {
      showAlert(
        'Ação não permitida',
        'A conta principal não pode ser excluída. Ela é essencial para o funcionamento do sistema.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    showAlert(
      'Excluir permanentemente?',
      `A conta "${editingAccount.name}" será excluída e não poderá ser recuperada. Os lançamentos associados a ela também serão excluídos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount(editingAccount.id);
            if (result) {
              setEditModalVisible(false);
              setEditingAccount(null);
              triggerRefresh();
              showSnackbar('Conta excluída!');
            } else {
              showAlert('Erro', 'Não foi possível excluir a conta', [{ text: 'OK', style: 'default' }]);
            }
          }
        },
      ]
    );
  }

  async function handleArchive(accountId: string, accountName: string) {
    showAlert(
      'O que deseja fazer?',
      `Conta: "${accountName}"`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Arquivar', 
          onPress: async () => {
            const result = await archiveAccount(accountId);
            if (!result) {
              showAlert('Erro', 'Não foi possível arquivar a conta', [{ text: 'OK', style: 'default' }]);
            } else {
              triggerRefresh();
            }
          }
        },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: () => confirmDelete(accountId, accountName),
        },
      ]
    );
  }

  async function confirmDelete(accountId: string, accountName: string) {
    showAlert(
      'Excluir permanentemente?',
      `A conta "${accountName}" será excluída e não poderá ser recuperada. Os lançamentos associados a ela também serão excluídos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount(accountId);
            if (result) {
              triggerRefresh();
              showSnackbar('Conta excluída!');
            } else {
              showAlert('Erro', 'Não foi possível excluir a conta', [{ text: 'OK', style: 'default' }]);
            }
          }
        },
      ]
    );
  }

  // Obter ícone do tipo de conta
  function getAccountIcon(type: AccountType, icon?: string): string {
    if (icon) return icon;
    const typeOption = ACCOUNT_TYPES.find(t => t.id === type);
    return typeOption?.icon || 'bank';
  }

  return (
    <MainLayout>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header simples */}
      <SimpleHeader title="Contas" />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
        {/* Saldo total */}
        {activeAccounts.length > 0 && (
          <View style={[styles.totalCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.totalLabel}>Saldo total</Text>
            <Text style={styles.totalValue}>{formatCurrencyBRL(totalBalance)}</Text>
          </View>
        )}

        {/* Contas existentes */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Carregando contas...</Text>
          </View>
        ) : activeAccounts.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              SUAS CONTAS
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              Toque para editar
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
              {activeAccounts.map((account, index) => (
                <Pressable
                  key={account.id}
                  onPress={() => openEditModal(account)}
                  onLongPress={() => handleArchive(account.id, account.name)}
                  delayLongPress={500}
                  style={({ pressed }) => [
                    styles.accountItem,
                    index < activeAccounts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: colors.primaryBg }]}>
                    <MaterialCommunityIcons 
                      name={getAccountIcon(account.type, account.icon) as any} 
                      size={20} 
                      color={colors.primary} 
                    />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountName, { color: colors.text }]}>{account.name}</Text>
                    <Text style={[styles.accountType, { color: colors.textMuted }]}>
                      {ACCOUNT_TYPE_LABELS[account.type]}
                    </Text>
                  </View>
                  <View style={styles.accountRight}>
                    <Text style={[
                      styles.accountBalance, 
                      { color: account.balance >= 0 ? colors.income : colors.expense }
                    ]}>
                      {formatCurrencyBRL(account.balance)}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={[styles.emptyCard, { backgroundColor: colors.card }, getShadow(colors)]}>
              <MaterialCommunityIcons name="bank-off-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Nenhuma conta cadastrada
              </Text>
            </View>
          </View>
        )}

        {/* Nova conta */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            CRIAR NOVA CONTA
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
            {/* Nome */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Nome da conta</Text>
              <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: Nubank, Caixa, Carteira..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </View>

            {/* Tipo */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Tipo da conta</Text>
              <View style={styles.typeGrid}>
                {ACCOUNT_TYPES.map((type) => (
                  <Pressable
                    key={type.id}
                    onPress={() => {
                      setSelectedType(type.id);
                      setSelectedIcon(type.icon);
                    }}
                    style={[
                      styles.typeOption,
                      { borderColor: selectedType === type.id ? colors.primary : colors.border },
                      selectedType === type.id && { backgroundColor: colors.primaryBg },
                    ]}
                  >
                    <MaterialCommunityIcons 
                      name={type.icon as any} 
                      size={22} 
                      color={selectedType === type.id ? colors.primary : colors.textMuted} 
                    />
                    <Text 
                      style={[
                        styles.typeLabel, 
                        { color: selectedType === type.id ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Ícone */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Ícone</Text>
              <View style={styles.iconGrid}>
                {ACCOUNT_ICONS.map((icon) => (
                  <Pressable
                    key={icon}
                    onPress={() => setSelectedIcon(icon)}
                    style={[
                      styles.iconOption,
                      { borderColor: selectedIcon === icon ? colors.primary : colors.border },
                      selectedIcon === icon && { backgroundColor: colors.primaryBg },
                    ]}
                  >
                    <MaterialCommunityIcons 
                      name={icon as any} 
                      size={22} 
                      color={selectedIcon === icon ? colors.primary : colors.textMuted} 
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Saldo inicial */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>Saldo inicial</Text>
                <Pressable 
                  onPress={() => setShowTooltip(!showTooltip)}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons 
                    name="information-outline" 
                    size={18} 
                    color={colors.primary} 
                  />
                </Pressable>
              </View>
              {showTooltip && (
                <View style={[styles.tooltip, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
                  <Text style={[styles.tooltipText, { color: colors.text }]}>
                    O saldo inicial representa quanto dinheiro você já tinha nessa conta ao começar a usar o app. Esse valor não é uma receita.
                  </Text>
                </View>
              )}
              <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                <Text style={[styles.currency, { color: colors.textMuted }]}>R$</Text>
                <TextInput
                  value={initialBalance}
                  onChangeText={(v) => setInitialBalance(formatCurrency(v))}
                  placeholder="0,00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </View>

            {/* Incluir no total */}
            <Pressable
              onPress={() => setIncludeInTotal(!includeInTotal)}
              style={styles.checkboxRow}
            >
              <View style={[
                styles.checkbox,
                { borderColor: colors.primary },
                includeInTotal && { backgroundColor: colors.primary },
              ]}>
                {includeInTotal && (
                  <MaterialCommunityIcons name="check" size={14} color="#fff" />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                Incluir no saldo total
              </Text>
            </Pressable>

            {/* Botão */}
            <Pressable
              onPress={handleCreate}
              disabled={saving || !name.trim()}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9 },
                (saving || !name.trim()) && { opacity: 0.6 },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={20} color="#fff" />
              <Text style={styles.createButtonText}>
                {saving ? 'Criando...' : 'Criar conta'}
              </Text>
            </Pressable>
          </View>
        </View>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Edição */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Header do Modal */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Conta</Text>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Nome */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nome da conta</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Nome da conta"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Saldo atual (somente leitura) */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Saldo atual</Text>
                <View style={[styles.balanceDisplay, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="cash" size={20} color={colors.textMuted} />
                  <Text style={[styles.balanceText, { color: colors.text }]}>
                    {formatCurrencyBRL(editingAccount?.balance || 0)}
                  </Text>
                </View>
                <Text style={[styles.helpText, { color: colors.textMuted }]}>
                  Para ajustar o saldo, use lançamentos ou "Resetar conta"
                </Text>
              </View>

              {/* Tipo */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Tipo da conta</Text>
                <View style={styles.typeGrid}>
                  {ACCOUNT_TYPES.map((type) => (
                    <Pressable
                      key={type.id}
                      onPress={() => {
                        setEditType(type.id);
                        setEditIcon(type.icon);
                      }}
                      style={[
                        styles.typeOptionSmall,
                        { borderColor: editType === type.id ? colors.primary : colors.border },
                        editType === type.id && { backgroundColor: colors.primaryBg },
                      ]}
                    >
                      <MaterialCommunityIcons 
                        name={type.icon as any} 
                        size={18} 
                        color={editType === type.id ? colors.primary : colors.textMuted} 
                      />
                      <Text 
                        style={[
                          styles.typeLabelSmall, 
                          { color: editType === type.id ? colors.primary : colors.textMuted },
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Ícone */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Ícone</Text>
                <View style={styles.iconGridModal}>
                  {ACCOUNT_ICONS.map((icon) => (
                    <Pressable
                      key={icon}
                      onPress={() => setEditIcon(icon)}
                      style={[
                        styles.iconOptionSmall,
                        { borderColor: editIcon === icon ? colors.primary : colors.border },
                        editIcon === icon && { backgroundColor: colors.primaryBg },
                      ]}
                    >
                      <MaterialCommunityIcons 
                        name={icon as any} 
                        size={18} 
                        color={editIcon === icon ? colors.primary : colors.textMuted} 
                      />
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Ações */}
              <View style={styles.modalActionsColumn}>
                {/* Botão de Recalcular Saldo */}
                <Pressable
                  onPress={handleRecalculateBalance}
                  style={({ pressed }) => [
                    styles.resetButton,
                    { backgroundColor: colors.income + '15', borderColor: colors.income },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <MaterialCommunityIcons name="calculator" size={20} color={colors.income} />
                  <View style={styles.resetButtonText}>
                    <Text style={[styles.actionButtonText, { color: colors.income }]}>Recalcular saldo</Text>
                    <Text style={[styles.resetHint, { color: colors.textMuted }]}>
                      Corrige inconsistências com base nos lançamentos
                    </Text>
                  </View>
                </Pressable>

                {/* Botão de Ajustar Saldo */}
                <Pressable
                  onPress={handleAdjustBalance}
                  style={({ pressed }) => [
                    styles.resetButton,
                    { backgroundColor: colors.primary + '15', borderColor: colors.primary },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <MaterialCommunityIcons name="tune" size={20} color={colors.primary} />
                  <View style={styles.resetButtonText}>
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>Ajustar saldo da conta</Text>
                    <Text style={[styles.resetHint, { color: colors.textMuted }]}>
                      Corrige o saldo sem alterar o histórico
                    </Text>
                  </View>
                </Pressable>

                {/* Botão de Resetar */}
                <Pressable
                  onPress={handleResetAccount}
                  style={({ pressed }) => [
                    styles.resetButton,
                    { backgroundColor: colors.warning + '15', borderColor: colors.warning },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <MaterialCommunityIcons name="refresh" size={20} color={colors.warning} />
                  <View style={styles.resetButtonText}>
                    <Text style={[styles.actionButtonText, { color: colors.warning }]}>Resetar conta</Text>
                    <Text style={[styles.resetHint, { color: colors.textMuted }]}>
                      Exclui todos os lançamentos e zera o saldo
                    </Text>
                  </View>
                </Pressable>

                {/* Botões de Confirmar e Excluir */}
                <View style={styles.modalActions}>
                  {/* Botão Excluir - oculto para conta padrão */}
                  {!editingAccount?.isDefault && (
                    <Pressable
                      onPress={handleDeleteFromModal}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.deleteButton,
                        { borderColor: colors.expense },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color={colors.expense} />
                      <Text style={[styles.actionButtonText, { color: colors.expense }]}>Excluir</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={handleSaveEdit}
                    disabled={saving || !editName.trim()}
                    style={({ pressed }) => [
                      styles.actionButton,
                      { backgroundColor: colors.primary, borderColor: colors.primary },
                      pressed && { opacity: 0.9 },
                      (saving || !editName.trim()) && { opacity: 0.6 },
                    ]}
                  >
                    <MaterialCommunityIcons name="check" size={20} color="#fff" />
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                      {saving ? 'Salvando...' : 'Confirmar'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Ajuste de Saldo */}
      <Modal
        visible={adjustBalanceModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAdjustBalanceModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setAdjustBalanceModalVisible(false)}
        >
          <Pressable 
            style={[styles.adjustBalanceModal, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.adjustBalanceTitle, { color: colors.text }]}>
              Ajustar saldo da conta
            </Text>
            <Text style={[styles.adjustBalanceSubtitle, { color: colors.textMuted }]}>
              {editingAccount?.name}
            </Text>
            <Text style={[styles.adjustBalanceInfo, { color: colors.textMuted }]}>
              Saldo atual: {formatCurrencyBRL(editingAccount?.balance || 0)}
            </Text>
            <Text style={[styles.adjustBalanceLabel, { color: colors.text }]}>
              Qual é o saldo real desta conta hoje?
            </Text>
            <View style={[styles.inputContainer, { borderColor: colors.border }]}>
              <Text style={[styles.currency, { color: colors.textMuted }]}>R$</Text>
              <TextInput
                value={adjustBalanceValue}
                onChangeText={(v) => setAdjustBalanceValue(formatCurrency(v))}
                placeholder="0,00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={[styles.input, { color: colors.text }]}
                autoFocus
              />
            </View>
            <View style={styles.adjustBalanceActions}>
              <Pressable
                onPress={() => setAdjustBalanceModalVisible(false)}
                style={[styles.adjustBalanceButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.adjustBalanceButtonText, { color: colors.text }]}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={performBalanceAdjustment}
                style={[styles.adjustBalanceButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.adjustBalanceButtonText, { color: '#fff' }]}>
                  Confirmar
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
      <Snackbar
        visible={snackbarState.visible}
        message={snackbarState.message}
        type={snackbarState.type}
        duration={snackbarState.duration}
        onDismiss={hideSnackbar}
      />
      <LoadingOverlay
        visible={loadingOverlay.visible}
        message={loadingOverlay.message}
        progress={loadingOverlay.progress}
      />
      </View>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  centeredContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  totalCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  sectionHint: {
    fontSize: 11,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '500',
  },
  accountType: {
    fontSize: 13,
    marginTop: 2,
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: '600',
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  formGroup: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  currency: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.xs,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  typeLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  typeOptionSmall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  typeLabelSmall: {
    fontSize: 9,
    marginTop: 2,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconOption: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    width: 40,
    height: 40,
  },
  iconGridModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconOptionSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    width: 36,
    height: 36,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tooltip: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  tooltipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.md,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 11,
    marginTop: spacing.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: spacing.md,
    paddingTop: 0,
  },
  modalActionsColumn: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  resetButtonText: {
    flex: 1,
  },
  resetHint: {
    fontSize: 11,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  deleteButton: {
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  balanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '600',
  },
  adjustBalanceModal: {
    backgroundColor: 'white',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    maxWidth: 400,
    width: '90%',
  },
  adjustBalanceTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  adjustBalanceSubtitle: {
    fontSize: 14,
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  adjustBalanceInfo: {
    fontSize: 13,
    marginBottom: spacing.lg,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  adjustBalanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  adjustBalanceActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  adjustBalanceButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  adjustBalanceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
