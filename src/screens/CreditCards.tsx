import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, Platform } from "react-native";
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/themeContext";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { useSnackbar } from "../hooks/useSnackbar";
import CustomAlert from "../components/CustomAlert";
import Snackbar from "../components/Snackbar";
import LoadingOverlay from "../components/LoadingOverlay";
import MainLayout from "../components/MainLayout";
import SimpleHeader from "../components/SimpleHeader";
import DayPicker from "../components/DayPicker";
import { useAuth } from "../contexts/authContext";
import { spacing, borderRadius, getShadow } from "../theme";
import { useCreditCards } from "../hooks/useCreditCards";
import { useAccounts } from "../hooks/useAccounts";
import { CreditCard } from "../types/firebase";
import { formatCurrencyBRL } from "../utils/format";
import { deleteTransactionsByCreditCard, countTransactionsByCreditCard } from "../services/transactionService";
import { updateCreditCard as updateCreditCardService } from "../services/creditCardService";
import { useTransactionRefresh } from "../contexts/transactionRefreshContext";

export default function CreditCards({ navigation }: any) {
  const route = useRoute<any>();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const { snackbarState, showSnackbar, hideSnackbar } = useSnackbar();
  const { triggerRefresh } = useTransactionRefresh();
  const insets = useSafeAreaInsets();
  
  const [saving, setSaving] = useState(false);
  
  // Estado para loading overlay (operações longas)
  const [loadingOverlay, setLoadingOverlay] = useState({
    visible: false,
    message: '',
    progress: null as { current: number; total: number } | null,
  });

  // Estado para modal unificada (criar/editar)
  const [modalVisible, setModalVisible] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('');
  const [cardDueDay, setCardDueDay] = useState('');
  const [cardAccountId, setCardAccountId] = useState('');
  const [cardAccountName, setCardAccountName] = useState('');
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Hooks do Firebase
  const { 
    activeCards, 
    totalLimit,
    loading, 
    createCreditCard,
    updateCreditCard,
    archiveCreditCard,
    deleteCreditCard,
  } = useCreditCards();
  
  const { activeAccounts } = useAccounts();

  // Abrir modal de criação automaticamente se vier da Home com openCreate=true
  useEffect(() => {
    if (route.params?.openCreate && activeAccounts.length > 0 && !loading) {
      // Pequeno delay para garantir que os estados estejam prontos
      const timer = setTimeout(() => {
        openCreateModal();
        // Limpar o parâmetro para não reabrir ao voltar
        navigation.setParams({ openCreate: undefined });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [route.params?.openCreate, activeAccounts.length, loading]);

  // Abrir modal de edição automaticamente se vier com editCardId
  useEffect(() => {
    if (route.params?.editCardId && activeCards.length > 0 && !loading) {
      const cardToEdit = activeCards.find(c => c.id === route.params.editCardId);
      if (cardToEdit) {
        const timer = setTimeout(() => {
          openEditModal(cardToEdit);
          navigation.setParams({ editCardId: undefined });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [route.params?.editCardId, activeCards.length, loading]);

  // Calcular total usado
  const totalUsed = activeCards.reduce((sum, card) => sum + (card.currentUsed || 0), 0);

  // Converter string de valor para número
  function parseValue(value: string): number {
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
    // Verificar se há contas cadastradas
    if (activeAccounts.length === 0) {
      showAlert(
        'Conta necessária',
        'Para cadastrar um cartão de crédito, você precisa ter pelo menos uma conta cadastrada para pagamento da fatura.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Criar conta', 
            onPress: () => {
              setModalVisible(false);
              navigation.navigate('ConfigureAccounts');
            },
          },
        ]
      );
      return;
    }

    if (!cardName.trim()) {
      showAlert('Erro', 'Informe o nome do cartão', [{ text: 'OK', style: 'default' }]);
      return;
    }

    if (!cardLimit.trim() || parseValue(cardLimit) <= 0) {
      showAlert('Erro', 'Informe o limite do cartão', [{ text: 'OK', style: 'default' }]);
      return;
    }

    if (!cardAccountId) {
      showAlert('Erro', 'Selecione a conta de pagamento da fatura', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    const closingDayNum = parseInt(cardClosingDay) || 1;
    const dueDayNum = parseInt(cardDueDay) || 10;
    
    if (closingDayNum < 1 || closingDayNum > 31 || dueDayNum < 1 || dueDayNum > 31) {
      showAlert('Erro', 'Os dias devem estar entre 1 e 31', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    // Verificar se já existe um cartão com o mesmo nome
    const nameExists = activeCards.some(
      card => card.name.toLowerCase() === cardName.trim().toLowerCase()
    );
    if (nameExists) {
      showAlert('Nome duplicado', 'Já existe um cartão com esse nome.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    setSaving(true);
    try {
      const cardData: any = {
        name: cardName.trim(),
        icon: 'credit-card',
        color: '#3B82F6',
        limit: parseValue(cardLimit),
        closingDay: closingDayNum,
        dueDay: dueDayNum,
        paymentAccountId: cardAccountId,
        isArchived: false,
      };

      const result = await createCreditCard(cardData);

      if (result) {
        setModalVisible(false);
        resetModalState();
        triggerRefresh();
        showSnackbar('Cartão cadastrado com sucesso!');
      } else {
        showAlert('Erro', 'Não foi possível cadastrar o cartão', [{ text: 'OK', style: 'default' }]);
      }
    } catch (error) {
      showAlert('Erro', 'Ocorreu um erro ao cadastrar o cartão', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }

  // Resetar estado do modal
  function resetModalState() {
    setCardName('');
    setCardLimit('');
    setCardClosingDay('');
    setCardDueDay('');
    setCardAccountId('');
    setCardAccountName('');
    setEditingCard(null);
    setIsCreateMode(false);
  }

  // Abrir modal para criar novo cartão
  function openCreateModal() {
    // Verificar se há contas cadastradas antes de abrir
    if (activeAccounts.length === 0) {
      showAlert(
        'Conta necessária',
        'Para cadastrar um cartão de crédito, você precisa ter pelo menos uma conta cadastrada para pagamento da fatura.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Criar conta', 
            onPress: () => navigation.navigate('ConfigureAccounts'),
          },
        ]
      );
      return;
    }
    resetModalState();
    setIsCreateMode(true);
    // Definir conta padrão se houver apenas uma
    if (activeAccounts.length === 1) {
      setCardAccountId(activeAccounts[0].id);
      setCardAccountName(activeAccounts[0].name);
    }
    setModalVisible(true);
  }

  // Arquivar cartão foi removido do fluxo.

  // Abrir modal de edição
  function openEditModal(card: CreditCard) {
    const account = activeAccounts.find(a => a.id === card.paymentAccountId);
    setEditingCard(card);
    setIsCreateMode(false);
    setCardName(card.name);
    // Formatar limite para exibição (1234.56 → "1.234,56")
    setCardLimit(card.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setCardClosingDay(card.closingDay.toString());
    setCardDueDay(card.dueDay.toString());
    setCardAccountId(card.paymentAccountId || '');
    setCardAccountName(account?.name || '');
    setModalVisible(true);
  }

  // Salvar edição
  async function handleSaveEdit() {
    if (!editingCard || !cardName.trim() || !user?.uid) return;

    const closingDayNum = parseInt(cardClosingDay) || 1;
    const dueDayNum = parseInt(cardDueDay) || 10;
    
    if (closingDayNum < 1 || closingDayNum > 31 || dueDayNum < 1 || dueDayNum > 31) {
      showAlert('Erro', 'Os dias devem estar entre 1 e 31', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    // Verificar se já existe outro cartão com o mesmo nome
    const nameExists = activeCards.some(
      card => card.id !== editingCard.id && 
              card.name.toLowerCase() === cardName.trim().toLowerCase()
    );
    if (nameExists) {
      showAlert('Nome duplicado', 'Já existe um cartão com esse nome.', [{ text: 'OK', style: 'default' }]);
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        name: cardName.trim(),
        limit: parseValue(cardLimit),
        closingDay: closingDayNum,
        dueDay: dueDayNum,
      };
      
      // Só adiciona paymentAccountId se tiver valor, senão remove
      if (cardAccountId) {
        updateData.paymentAccountId = cardAccountId;
      } else {
        updateData.paymentAccountId = null; // Remove do documento
      }

      const result = await updateCreditCard(editingCard.id, updateData);

      if (result) {
        setModalVisible(false);
        resetModalState();
        triggerRefresh();
        showSnackbar('Cartão atualizado!');
      } else {
        showAlert('Erro', 'Não foi possível atualizar o cartão', [{ text: 'OK', style: 'default' }]);
      }
    } catch (error) {
      showAlert('Erro', 'Ocorreu um erro ao atualizar o cartão', [{ text: 'OK', style: 'default' }]);
    } finally {
      setSaving(false);
    }
  }

  // Resetar cartão (deletar todas as transações)
  async function handleResetCard() {
    if (!editingCard || !user?.uid) return;
    
    const count = await countTransactionsByCreditCard(user.uid, editingCard.id);
    
    if (count === 0) {
      showAlert('Aviso', 'Este cartão não possui lançamentos para excluir.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    
    showAlert(
      'Resetar cartão?',
      `Esta ação irá excluir ${count} lançamento${count > 1 ? 's' : ''} deste cartão e zerar o valor usado. Esta ação NÃO pode ser desfeita!`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Resetar', 
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              // Deletar todas as transações
              const { deleted, error } = await deleteTransactionsByCreditCard(user.uid, editingCard.id);
              
              if (error) {
                showAlert('Erro', error, [{ text: 'OK', style: 'default' }]);
                return;
              }
              
              // Zerar o valor usado do cartão
              await updateCreditCardService(editingCard.id, { currentUsed: 0 });

              triggerRefresh();
              
              showAlert(
                'Cartão resetado', 
                `${deleted} lançamento${deleted > 1 ? 's' : ''} excluído${deleted > 1 ? 's' : ''}. Fatura zerada.`,
                [{ text: 'OK', style: 'default' }]
              );
              
              // Fechar modal e atualizar lista
              setModalVisible(false);
              resetModalState();
            } catch (err) {
              showAlert('Erro', 'Ocorreu um erro ao resetar o cartão', [{ text: 'OK', style: 'default' }]);
            } finally {
              setSaving(false);
            }
          }
        },
      ]
    );
  }

  // Arquivar cartão no modal foi removido.

  // Excluir cartão do modal
  async function handleDeleteFromModal() {
    if (!editingCard || !user?.uid) return;
    
    // Contar transações antes de confirmar
    const transactionCount = await countTransactionsByCreditCard(user.uid, editingCard.id);
    
    const message = transactionCount > 0
      ? `O cartão "${editingCard.name}" será excluído junto com ${transactionCount} lançamento${transactionCount > 1 ? 's' : ''}. Esta ação não pode ser desfeita.`
      : `O cartão "${editingCard.name}" será excluído e não poderá ser recuperado.`;
    
    showAlert(
      'Excluir permanentemente?',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            // Fechar modal primeiro
            setModalVisible(false);
            
            // Mostrar loading overlay se houver muitas transações
            if (transactionCount > 5) {
              setLoadingOverlay({
                visible: true,
                message: `Excluindo ${transactionCount} lançamentos...`,
                progress: null,
              });
            }
            
            try {
              const result = await deleteCreditCard(editingCard.id);
              
              // Esconder loading overlay
              setLoadingOverlay({ visible: false, message: '', progress: null });
              
              if (result) {
                setEditingCard(null);
                triggerRefresh();
                showSnackbar('Cartão excluído!');
              } else {
                showAlert('Erro', 'Não foi possível excluir o cartão', [{ text: 'OK', style: 'default' }]);
              }
            } catch (error) {
              setLoadingOverlay({ visible: false, message: '', progress: null });
              showAlert('Erro', 'Ocorreu um erro ao excluir o cartão', [{ text: 'OK', style: 'default' }]);
            }
          }
        },
      ]
    );
  }

  return (
    <MainLayout>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header simples */}
      <SimpleHeader title="Cartões de Crédito" />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
        {/* Resumo de limites */}
        {activeCards.length > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Limite total</Text>
                <Text style={styles.summaryValue}>{formatCurrencyBRL(totalLimit)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Usado</Text>
                <Text style={styles.summaryValue}>{formatCurrencyBRL(totalUsed)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Disponível</Text>
                <Text style={styles.summaryValue}>{formatCurrencyBRL(totalLimit - totalUsed)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Cartões existentes */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Carregando cartões...</Text>
          </View>
        ) : activeCards.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              SEUS CARTÕES
            </Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              Toque para editar
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
              {activeCards.map((card, index) => {
                const cardColor = card.color || colors.primary;
                const available = card.limit - (card.currentUsed || 0);
                return (
                  <Pressable
                    key={card.id}
                    onPress={() => openEditModal(card)}
                    style={({ pressed }) => [
                      styles.cardItem,
                      index < activeCards.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: cardColor + '20' }]}>
                      <MaterialCommunityIcons 
                        name="credit-card"
                        size={20} 
                        color={cardColor} 
                      />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardName, { color: colors.text }]}>{card.name}</Text>
                      <Text style={[styles.cardDetails, { color: colors.textSecondary }]}>
                        Limite: {formatCurrencyBRL(card.limit)} • Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                      </Text>
                      <View style={styles.usageBar}>
                        <View 
                          style={[
                            styles.usageBarFill, 
                            { 
                              backgroundColor: cardColor,
                              width: `${Math.min(((card.currentUsed || 0) / card.limit) * 100, 100)}%` 
                            }
                          ]} 
                        />
                      </View>
                      <Text style={[styles.availableText, { color: colors.textMuted }]}>
                        Disponível: {formatCurrencyBRL(available)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={[styles.emptyCard, { backgroundColor: colors.card }, getShadow(colors)]}>
              <MaterialCommunityIcons name="credit-card-off-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Nenhum cartão cadastrado
              </Text>
            </View>
          </View>
        )}

        {/* Botão para cadastrar novo cartão */}
        <Pressable
          onPress={openCreateModal}
          style={({ pressed }) => [
            styles.addCardButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
          <Text style={styles.addCardButtonText}>Cadastrar novo cartão</Text>
        </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Modal unificada para Criar/Editar Cartão */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <View style={[styles.fullscreenModal, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
          {/* Header moderno com botão de fechar */}
          <View style={[styles.fullscreenHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fullscreenTitle, { color: colors.text }]}>
              {isCreateMode ? 'Novo Cartão' : 'Editar Cartão'}
            </Text>
            <Pressable 
              onPress={() => setModalVisible(false)} 
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.grayLight },
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          
          <ScrollView 
            style={styles.fullscreenContent}
            contentContainerStyle={styles.fullscreenContentContainer}
            showsVerticalScrollIndicator={false}
          >
              {/* Nome */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nome do cartão</Text>
                <View style={[
                  styles.inputContainer, 
                  { 
                    borderColor: focusedField === 'name' ? colors.primary : colors.border, 
                    backgroundColor: colors.card 
                  }
                ]}>
                  <TextInput
                    value={cardName}
                    onChangeText={setCardName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Ex: Nubank, Itaú..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Limite */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Limite</Text>
                <View style={[
                  styles.inputContainer, 
                  { 
                    borderColor: focusedField === 'limit' ? colors.primary : colors.border, 
                    backgroundColor: colors.card 
                  }
                ]}>
                  <Text style={[styles.currency, { color: colors.textMuted }]}>R$</Text>
                  <TextInput
                    value={cardLimit}
                    onChangeText={(v) => setCardLimit(formatCurrency(v))}
                    onFocus={() => setFocusedField('limit')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="0,00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
              </View>

              {/* Dias lado a lado */}
              <View style={styles.daysRow}>
                <DayPicker
                  label="Fechamento da fatura"
                  value={cardClosingDay}
                  onChange={setCardClosingDay}
                  placeholder="Dia"
                  focused={focusedField === 'closingDay'}
                  onFocus={() => setFocusedField('closingDay')}
                  onBlur={() => setFocusedField(null)}
                />

                <DayPicker
                  label="Vencimento da fatura"
                  value={cardDueDay}
                  onChange={setCardDueDay}
                  placeholder="Dia"
                  focused={focusedField === 'dueDay'}
                  onFocus={() => setFocusedField('dueDay')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Conta de pagamento */}
              <View style={styles.formGroup}>
                <View style={styles.labelWithHelp}>
                  <Text style={[styles.label, { color: colors.text }]}>Conta de pagamento</Text>
                  <Pressable
                    onPress={() => showAlert(
                      'Conta de pagamento',
                      'Quando você pagar a fatura deste cartão, o valor será debitado automaticamente desta conta.',
                      [{ text: 'Entendi', style: 'default' }]
                    )}
                  >
                    <Text style={[styles.helpLink, { color: colors.primary }]}>saiba mais</Text>
                  </Pressable>
                </View>
                <Pressable 
                  onPress={() => setShowAccountPicker(true)}
                  style={[styles.selectButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Text style={[
                    styles.selectText, 
                    { color: cardAccountName ? colors.text : colors.textMuted }
                  ]}>
                    {cardAccountName || 'Selecione a conta'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Ações */}
              <View style={styles.modalActionsColumn}>
                {/* Botão de Resetar - apenas no modo edição */}
                {!isCreateMode && (
                  <Pressable
                    onPress={handleResetCard}
                    style={({ pressed }) => [
                      styles.resetButton,
                      { backgroundColor: colors.warning + '15', borderColor: colors.warning },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <MaterialCommunityIcons name="refresh" size={20} color={colors.warning} />
                    <View style={styles.resetButtonText}>
                      <Text style={[styles.actionButtonText, { color: colors.warning }]}>Resetar cartão</Text>
                      <Text style={[styles.resetHint, { color: colors.textMuted }]}>
                        Exclui todos os lançamentos e zera a fatura
                      </Text>
                    </View>
                  </Pressable>
                )}

                {/* Botões de Confirmar e Excluir/Cancelar */}
                <View style={styles.modalActions}>
                  {isCreateMode ? (
                    <Pressable
                      onPress={() => setModalVisible(false)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.cancelButton,
                        { borderColor: colors.border },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Cancelar</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleDeleteFromModal}
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.deleteButtonStyle,
                        { borderColor: colors.expense },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color={colors.expense} />
                      <Text style={[styles.actionButtonText, { color: colors.expense }]}>Excluir</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={isCreateMode ? handleCreate : handleSaveEdit}
                    disabled={saving || !cardName.trim()}
                    style={({ pressed }) => [
                      styles.actionButton,
                      { backgroundColor: colors.primary, borderColor: colors.primary },
                      pressed && { opacity: 0.9 },
                      (saving || !cardName.trim()) && { opacity: 0.6 },
                    ]}
                  >
                    <MaterialCommunityIcons name="check" size={20} color="#fff" />
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                      {saving ? 'Salvando...' : (isCreateMode ? 'Cadastrar' : 'Confirmar')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
      </Modal>

      {/* Modal de seleção de conta */}
      <Modal
        visible={showAccountPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAccountPicker(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowAccountPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Selecionar conta</Text>
            {!isCreateMode && (
              <Pressable
                onPress={() => {
                  setCardAccountId('');
                  setCardAccountName('');
                  setShowAccountPicker(false);
                }}
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.modalOptionText, { color: colors.textMuted }]}>Nenhuma conta</Text>
                {cardAccountId === '' && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            )}
            {activeAccounts.map((account) => (
              <Pressable
                key={account.id}
                onPress={() => {
                  setCardAccountId(account.id);
                  setCardAccountName(account.name);
                  setShowAccountPicker(false);
                }}
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
              >
                <MaterialCommunityIcons name="bank" size={20} color={colors.primary} />
                <Text style={[styles.modalOptionText, { color: colors.text }]}>{account.name}</Text>
                {cardAccountId === account.id && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
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
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardDetails: {
    fontSize: 13,
    marginTop: 2,
  },
  usageBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  availableText: {
    fontSize: 12,
    marginTop: 4,
  },
  formGroup: {
    marginBottom: spacing.md,
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
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  currency: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  selectText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  // Fullscreen modal styles
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
  fullscreenContent: {
    flex: 1,
  },
  fullscreenContentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    maxWidth: '100%',
  },
  // Days row
  daysRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dayField: {
    flex: 1,
  },
  centeredInput: {
    textAlign: 'center',
  },
  // Label with help
  labelWithHelp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  helpLink: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  modalOptionText: {
    fontSize: 16,
    flex: 1,
  },
  helpText: {
    fontSize: 11,
    marginTop: spacing.xs,
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
  deleteButtonStyle: {
    backgroundColor: 'transparent',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Botão de adicionar cartão
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addCardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
