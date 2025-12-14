import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCustomAlert } from "../hooks/useCustomAlert";
import CustomAlert from "../components/CustomAlert";
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../contexts/themeContext';
import { useAuth } from '../contexts/authContext';
import { useAccounts } from '../hooks/useAccounts';
import AppHeader from '../components/AppHeader';
import MainLayout from '../components/MainLayout';
import { spacing, borderRadius, getShadow } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import {
    getBillDetails,
    payBill,
    unpayBill,
    getMonthName,
    CreditCardBillWithTransactions
} from '../services/creditCardBillService';
import type { Transaction } from '../types/firebase';

interface RouteParams {
  creditCardId: string;
  creditCardName: string;
  month: number;
  year: number;
}

export default function CreditCardBillDetails() {
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;
  
  const { activeAccounts } = useAccounts();
  
  const [bill, setBill] = useState<CreditCardBillWithTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [unpaying, setUnpaying] = useState(false);
  
  // Modal de seleção de conta para pagamento
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState('');

  // Carregar detalhes da fatura
  const loadBillDetails = async () => {
    if (!user) return;
    
    try {
      const billData = await getBillDetails(
        user.uid,
        params.creditCardId,
        params.month,
        params.year
      );
      setBill(billData);
    } catch (error) {
      console.error('Erro ao carregar fatura:', error);
      showAlert('Erro', 'Não foi possível carregar os detalhes da fatura', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBillDetails();
  }, [user, params]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBillDetails();
  };

  // Agrupar transações por data
  const groupedTransactions = useMemo(() => {
    if (!bill?.transactions) return {};
    
    const groups: Record<string, Transaction[]> = {};
    bill.transactions.forEach((t) => {
      const date = t.date.toDate().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long' 
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    
    return groups;
  }, [bill?.transactions]);

  // Calcular resumo
  const summary = useMemo(() => {
    if (!bill?.transactions) return { expenses: 0, refunds: 0, total: 0 };
    
    let expenses = 0;
    let refunds = 0;
    
    bill.transactions.forEach((t) => {
      if (t.status === 'cancelled') return;
      if (t.type === 'expense') expenses += t.amount;
      else refunds += t.amount;
    });
    
    return {
      expenses,
      refunds,
      total: expenses - refunds,
    };
  }, [bill?.transactions]);

  // Abrir modal de pagamento
  const handlePayBill = () => {
    if (!bill?.creditCard?.paymentAccountId) {
      showAlert(
        'Conta não configurada',
        'Este cartão não tem uma conta de pagamento configurada. Edite o cartão para definir uma conta.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Pré-selecionar a conta de pagamento do cartão
    const paymentAccount = activeAccounts.find(a => a.id === bill.creditCard?.paymentAccountId);
    if (paymentAccount) {
      setSelectedAccountId(paymentAccount.id);
      setSelectedAccountName(paymentAccount.name);
    }
    
    setPayModalVisible(true);
  };

  // Confirmar pagamento
  const confirmPayment = async () => {
    if (!bill || !selectedAccountId) return;
    
    const accountName = selectedAccountName || 'conta selecionada';
    
    showAlert(
      'Confirmar Pagamento',
      `Você está pagando a fatura de ${formatCurrencyBRL(summary.total)} na conta ${accountName}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar',
          onPress: async () => {
            setPaying(true);
            try {
              await payBill(
                bill.id,
                bill.creditCardId,
                selectedAccountId,
                summary.total
              );
              
              showAlert('Sucesso', 'Fatura paga com sucesso!', [{ text: 'OK' }]);
              setPayModalVisible(false);
              loadBillDetails(); // Recarregar dados
            } catch (error) {
              console.error('Erro ao pagar fatura:', error);
              showAlert('Erro', 'Não foi possível pagar a fatura', [{ text: 'OK' }]);
            } finally {
              setPaying(false);
            }
          },
        },
      ]
    );
  };

  // Título da fatura
  const billTitle = `Fatura ${getMonthName(params.month)} ${params.year}`;

  return (
    <MainLayout>
      <AppHeader 
        title={params.creditCardName}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Card do resumo da fatura */}
        <View style={[styles.billCard, { backgroundColor: colors.card, ...getShadow(colors) }]}>
          <View style={styles.billHeader}>
            <MaterialCommunityIcons name="credit-card" size={32} color={colors.primary} />
            <View style={styles.billTitleContainer}>
              <Text style={[styles.billTitle, { color: colors.text }]}>{billTitle}</Text>
              {bill?.dueDate && (
                <Text style={[styles.dueDateText, { color: colors.textMuted }]}>Vencimento: {bill.dueDate.toDate().toLocaleDateString('pt-BR')}</Text>
              )}
              {bill?.isPaid ? (
                <View style={[styles.statusBadge, { backgroundColor: '#10b98120' }]}>
                  <MaterialCommunityIcons name="check-circle" size={14} color="#10b981" />
                  <Text style={[styles.statusText, { color: '#10b981' }]}>Paga</Text>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: '#f9731620' }]}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color="#f97316" />
                  <Text style={[styles.statusText, { color: '#f97316' }]}>Pagamento Pendente</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.billAmount}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total da Fatura</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatCurrencyBRL(summary.total)}
            </Text>
          </View>
          
          <View style={[styles.summaryRow, { borderTopColor: colors.border }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Despesas</Text>
              <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
                {formatCurrencyBRL(-summary.expenses)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Estornos</Text>
              <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                {formatCurrencyBRL(summary.refunds)}
              </Text>
            </View>
          </View>
          
          {/* Botão de pagar fatura */}
          {!bill?.isPaid && summary.total > 0 && (
            <Pressable
              style={[styles.payButton, { backgroundColor: colors.primary }]}
              onPress={handlePayBill}
            >
              <MaterialCommunityIcons name="cash-check" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Pagar Fatura</Text>
            </Pressable>
          )}
          {/* Botão desfazer pagamento */}
          {bill?.isPaid && (
            <Pressable
              style={[styles.unpayButton, { borderColor: colors.border }]}
              onPress={() => {
                showAlert(
                  'Desfazer pagamento',
                  'Tem certeza que deseja desfazer o pagamento desta fatura? O débito será estornado na conta usada.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Desfazer',
                      onPress: async () => {
                        setUnpaying(true);
                        try {
                          await unpayBill(bill.id);
                          showAlert('Sucesso', 'Pagamento desfeito com sucesso', [{ text: 'OK' }]);
                          loadBillDetails();
                        } catch (err) {
                          console.error('Erro ao desfazer pagamento:', err);
                          showAlert('Erro', 'Não foi possível desfazer o pagamento', [{ text: 'OK' }]);
                        } finally {
                          setUnpaying(false);
                        }
                      }
                    }
                  ]
                );
              }}
              disabled={unpaying}
            >
              <MaterialCommunityIcons name="undo" size={18} color={colors.text} />
              <Text style={[styles.unpayButtonText, { color: colors.text }]}>
                {unpaying ? 'Desfazendo...' : 'Desfazer pagamento'}
              </Text>
            </Pressable>
          )}
        </View>
        
        {/* Lista de transações */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Lançamentos ({bill?.transactions?.length || 0})
        </Text>
        
        {Object.entries(groupedTransactions).map(([date, transactions]) => (
          <View key={date} style={styles.dateGroup}>
            <Text style={[styles.dateHeader, { color: colors.textMuted }]}>{date}</Text>
            {transactions.map((t) => (
              <View 
                key={t.id} 
                style={[styles.transactionItem, { backgroundColor: colors.card }]}
              >
                <View style={[styles.transactionIcon, { backgroundColor: (t.type === 'expense' ? '#dc262620' : '#10b98120') }]}>
                  <MaterialCommunityIcons 
                    name={t.categoryIcon as any || 'tag-outline'} 
                    size={20} 
                    color={t.type === 'expense' ? '#dc2626' : '#10b981'} 
                  />
                </View>
                <View style={styles.transactionContent}>
                  <Text style={[styles.transactionTitle, { color: colors.text }]} numberOfLines={1}>
                    {t.description}
                  </Text>
                  <Text style={[styles.transactionCategory, { color: colors.textMuted }]}>
                    {t.categoryName || 'Sem categoria'}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount, 
                  { color: t.type === 'expense' ? '#dc2626' : '#10b981' }
                ]}>
                  {t.type === 'expense' ? '-' : '+'}{formatCurrencyBRL(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        ))}
        
        {(!bill?.transactions || bill.transactions.length === 0) && !loading && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="receipt-text-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Nenhum lançamento nesta fatura
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Modal de seleção de conta */}
      <Modal
        visible={payModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setPayModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Selecione a conta de pagamento
            </Text>
            
            <ScrollView style={styles.accountList}>
              {activeAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  style={[
                    styles.accountOption,
                    { 
                      borderColor: selectedAccountId === account.id ? colors.primary : colors.border,
                      backgroundColor: selectedAccountId === account.id ? colors.primary + '10' : 'transparent',
                    }
                  ]}
                  onPress={() => {
                    setSelectedAccountId(account.id);
                    setSelectedAccountName(account.name);
                  }}
                >
                  <MaterialCommunityIcons 
                    name={account.icon as any || 'bank'} 
                    size={24} 
                    color={selectedAccountId === account.id ? colors.primary : colors.text} 
                  />
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountName, { color: colors.text }]}>{account.name}</Text>
                    <Text style={[styles.accountBalance, { color: colors.textMuted }]}>
                      Saldo: {formatCurrencyBRL(account.balance)}
                    </Text>
                  </View>
                  {selectedAccountId === account.id && (
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => setPayModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton, 
                  styles.modalButtonPrimary, 
                  { backgroundColor: colors.primary, opacity: paying || !selectedAccountId ? 0.6 : 1 }
                ]}
                onPress={confirmPayment}
                disabled={paying || !selectedAccountId}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {paying ? 'Pagando...' : 'Confirmar'}
                </Text>
              </Pressable>
            </View>
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
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  billCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  billTitleContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  billTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  billAmount: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  totalLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unpayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
  },
  unpayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dueDateText: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  dateGroup: {
    marginBottom: spacing.md,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  transactionCategory: {
    fontSize: 13,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 15,
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  accountList: {
    maxHeight: 300,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginBottom: spacing.sm,
  },
  accountInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '500',
  },
  accountBalance: {
    fontSize: 13,
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
