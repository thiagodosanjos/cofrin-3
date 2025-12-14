import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ScrollView, Modal } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/themeContext";
import { useAuth } from "../contexts/authContext";
import { spacing, borderRadius, getShadow } from "../theme";
import { useAccounts } from "../hooks/useAccounts";
import { useCustomAlert } from "../hooks/useCustomAlert";
import CustomAlert from "../components/CustomAlert";
import { AccountType, ACCOUNT_TYPE_LABELS, Account } from "../types/firebase";
import { formatCurrencyBRL } from "../utils/format";
import { createBalanceAdjustment, deleteTransactionsByAccount, countTransactionsByAccount } from "../services/transactionService";
import { setAccountBalance } from "../services/accountService";

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
  'bank', 'bank-outline', 'piggy-bank', 'wallet', 'wallet-outline',
  'cash', 'credit-card', 'safe', 'chart-line', 'bitcoin',
];

export default function ConfigureAccounts({ navigation }: any) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<AccountType>('checking');
  const [selectedIcon, setSelectedIcon] = useState('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [includeInTotal, setIncludeInTotal] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estado para modal de edição
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editType, setEditType] = useState<AccountType>('checking');
  const [editIcon, setEditIcon] = useState('bank');
  const [editIncludeInTotal, setEditIncludeInTotal] = useState(true);

  // Hook de contas do Firebase
  const { 
    activeAccounts,
    totalBalance,
    loading, 
    createAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
  } = useAccounts();

  // Converter string de valor para número
  function parseBalance(value: string): number {
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

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
        showAlert('Sucesso', 'Conta criada com sucesso!', [{ text: 'OK', style: 'default' }]);
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
    setEditBalance(account.balance.toString().replace('.', ','));
    setEditType(account.type);
    setEditIcon(account.icon || getAccountIcon(account.type));
    setEditIncludeInTotal(account.includeInTotal);
    setEditModalVisible(true);
  }

  // Salvar edição
  async function handleSaveEdit() {
    if (!editingAccount || !editName.trim() || !user?.uid) return;

    setSaving(true);
    try {
      const newBalance = parseBalance(editBalance);
      const oldBalance = editingAccount.balance;
      const balanceChanged = newBalance !== oldBalance;
      
      // Se o saldo mudou, criar transação de ajuste
      if (balanceChanged) {
        await createBalanceAdjustment(
          user.uid,
          editingAccount.id,
          editName.trim(),
          oldBalance,
          newBalance
        );
      }
      
      const result = await updateAccount(editingAccount.id, {
        name: editName.trim(),
        type: editType,
        icon: editIcon,
        balance: newBalance,
        includeInTotal: editIncludeInTotal,
      });

      if (result) {
        setEditModalVisible(false);
        setEditingAccount(null);
        
        if (balanceChanged) {
          const diff = newBalance - oldBalance;
          showAlert(
            'Conta atualizada', 
            `Ajuste de saldo registrado: ${diff >= 0 ? '+' : ''}${formatCurrencyBRL(diff)}`,
            [{ text: 'OK', style: 'default' }]
          );
        } else {
          showAlert('Sucesso', 'Conta atualizada com sucesso!', [{ text: 'OK', style: 'default' }]);
        }
      } else {
        showAlert('Erro', 'Não foi possível atualizar a conta', [{ text: 'OK', style: 'default' }]);
      }
    } catch (error) {
      showAlert('Erro', 'Ocorreu um erro ao atualizar a conta', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }

  // Resetar conta (deletar todas as transações)
  async function handleResetAccount() {
    if (!editingAccount || !user?.uid) return;
    
    // Primeiro, contar quantas transações existem
    const count = await countTransactionsByAccount(user.uid, editingAccount.id);
    
    if (count === 0) {
      showAlert('Aviso', 'Esta conta não possui lançamentos para excluir.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    showAlert(
      'Resetar conta?',
      `Esta ação irá excluir ${count} lançamento${count > 1 ? 's' : ''} desta conta e zerar o saldo. Esta ação NÃO pode ser desfeita!`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Resetar', 
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              // Deletar todas as transações
              const { deleted, error } = await deleteTransactionsByAccount(user.uid, editingAccount.id);
              
              if (error) {
                showAlert('Erro', error, [{ text: 'OK', style: 'default' }]);
                return;
              }
              
              // Zerar o saldo da conta
              await setAccountBalance(editingAccount.id, 0);
              
              // Atualizar estado local
              setEditBalance('0');
              
              showAlert(
                'Conta resetada', 
                `${deleted} lançamento${deleted > 1 ? 's' : ''} excluído${deleted > 1 ? 's' : ''}. Saldo zerado.`,
                [{ text: 'OK', style: 'default' }]
              );
              
              // Fechar modal e atualizar lista
              setEditModalVisible(false);
              setEditingAccount(null);
            } catch (err) {
              showAlert('Erro', 'Ocorreu um erro ao resetar a conta', [{ text: 'OK', style: 'default' }]);
            } finally {
              setSaving(false);
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
    
    showAlert(
      'Excluir permanentemente?',
      `A conta "${editingAccount.name}" será excluída e não poderá ser recuperada. Lançamentos associados NÃO serão excluídos.`,
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
              showAlert('Sucesso', 'Conta excluída com sucesso!', [{ text: 'OK', style: 'default' }]);
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
      `A conta "${accountName}" será excluída e não poderá ser recuperada. Lançamentos associados NÃO serão excluídos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount(accountId);
            if (result) {
              showAlert('Sucesso', 'Conta excluída com sucesso!', [{ text: 'OK', style: 'default' }]);
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
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Pressable 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Contas</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
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
              <Text style={[styles.label, { color: colors.text }]}>Saldo inicial</Text>
              <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                <Text style={[styles.currency, { color: colors.textMuted }]}>R$</Text>
                <TextInput
                  value={initialBalance}
                  onChangeText={setInitialBalance}
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
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Editar Conta</Text>
              <Pressable onPress={handleSaveEdit} disabled={saving} hitSlop={12}>
                <MaterialCommunityIcons 
                  name="check" 
                  size={24} 
                  color={saving ? colors.textMuted : colors.primary} 
                />
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

              {/* Saldo atual */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Saldo atual</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                  <Text style={[styles.currency, { color: colors.textMuted }]}>R$</Text>
                  <TextInput
                    value={editBalance}
                    onChangeText={setEditBalance}
                    placeholder="0,00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
                <Text style={[styles.helpText, { color: colors.textMuted }]}>
                  Ajuste o saldo diretamente se precisar corrigir
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

              {/* Incluir no total */}
              <Pressable
                onPress={() => setEditIncludeInTotal(!editIncludeInTotal)}
                style={styles.checkboxRow}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: colors.primary },
                  editIncludeInTotal && { backgroundColor: colors.primary },
                ]}>
                  {editIncludeInTotal && (
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                  Incluir no saldo total
                </Text>
              </Pressable>

              {/* Ações */}
              <View style={styles.modalActionsColumn}>
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

                {/* Botões de Arquivar e Excluir */}
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={handleArchiveFromModal}
                    style={({ pressed }) => [
                      styles.actionButton,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <MaterialCommunityIcons name="archive-outline" size={20} color={colors.textMuted} />
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Arquivar</Text>
                  </Pressable>

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
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: spacing.md,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: spacing.md,
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
});
