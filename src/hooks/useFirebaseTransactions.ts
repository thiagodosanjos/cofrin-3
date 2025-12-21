// ==========================================
// HOOK DE TRANSAÇÕES
// ==========================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/authContext';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import {
    Transaction,
    CreateTransactionInput,
    UpdateTransactionInput,
    TransactionType,
} from '../types/firebase';
import * as transactionService from '../services/transactionService';

interface UseTransactionsOptions {
  month?: number;
  year?: number;
  type?: TransactionType;
  accountId?: string;
  creditCardId?: string;
  limit?: number;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [carryOverBalance, setCarryOverBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { month, year, type, accountId, creditCardId, limit } = options;

  // Carregar transações
  const loadTransactions = useCallback(async () => {
    if (!user?.uid) {
      setTransactions([]);
      setCarryOverBalance(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let data: Transaction[];
      let targetMonth = month;
      let targetYear = year;

      if (accountId) {
        // Buscar por conta (respeitando mês/ano quando informados)
        data = await transactionService.getTransactionsByAccount(user.uid, accountId, month, year);
      } else if (creditCardId) {
        // Buscar por cartão de crédito
        data = await transactionService.getTransactionsByCreditCard(
          user.uid,
          creditCardId,
          month,
          year
        );
      } else if (type && month && year) {
        // Buscar por tipo e mês
        data = await transactionService.getTransactionsByType(user.uid, type, month, year);
      } else if (month && year) {
        // Buscar por mês
        data = await transactionService.getTransactionsByMonth(user.uid, month, year);
      } else if (limit) {
        // Buscar recentes com limite
        data = await transactionService.getRecentTransactions(user.uid, limit);
      } else {
        // Buscar mês atual
        const now = new Date();
        targetMonth = now.getMonth() + 1;
        targetYear = now.getFullYear();
        data = await transactionService.getTransactionsByMonth(
          user.uid,
          targetMonth,
          targetYear
        );
      }

      setTransactions(data);

      // Carregar saldo acumulado dos meses anteriores (apenas se tiver mês/ano definido)
      if (targetMonth && targetYear) {
        let carryOver: number;
        
        if (accountId) {
          // Se estiver filtrado por conta, usar função específica que inclui saldo inicial
          carryOver = await transactionService.getAccountCarryOverBalance(
            user.uid,
            accountId,
            targetMonth,
            targetYear
          );
        } else {
          // Caso geral: saldo consolidado de todas as contas
          carryOver = await transactionService.getCarryOverBalance(
            user.uid,
            targetMonth,
            targetYear
          );
        }
        setCarryOverBalance(carryOver);
      } else {
        setCarryOverBalance(0);
      }
    } catch (err) {
      console.error('Erro ao carregar transações:', err);
      setError('Erro ao carregar transações');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, month, year, type, accountId, creditCardId, limit]);

  // Carregar ao montar
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Criar transação
  const createTransaction = async (data: CreateTransactionInput): Promise<Transaction | null> => {
    if (!user?.uid) return null;

    try {
      const newTransaction = await transactionService.createTransaction(user.uid, data);
      setTransactions(prev => [newTransaction, ...prev]);
      return newTransaction;
    } catch (err) {
      console.error('Erro ao criar transação:', err);
      setError('Erro ao criar transação');
      return null;
    }
  };

  // Atualizar transação
  const updateTransaction = async (
    transactionId: string,
    data: UpdateTransactionInput
  ): Promise<boolean> => {
    try {
      // Primeiro tentar encontrar no estado local
      let oldTransaction = transactions.find(t => t.id === transactionId);
      
      // Se não encontrou no estado local, buscar do Firebase
      // (pode acontecer se a transação é de outro mês)
      if (!oldTransaction) {
        oldTransaction = await transactionService.getTransactionById(transactionId) ?? undefined;
        if (!oldTransaction) {
          setError('Transação não encontrada');
          return false;
        }
      }

      await transactionService.updateTransaction(transactionId, data, oldTransaction);
      setTransactions(prev =>
        prev.map(t => t.id === transactionId ? { ...t, ...data } : t)
      );
      return true;
    } catch (err) {
      console.error('Erro ao atualizar transação:', err);
      setError('Erro ao atualizar transação');
      return false;
    }
  };

  // Deletar transação
  const deleteTransaction = async (transactionId: string): Promise<boolean> => {
    try {
      // Buscar transação diretamente do banco caso não esteja no estado
      let transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) {
        // Buscar do banco de dados
        transaction = await transactionService.getTransactionById(transactionId);
        if (!transaction) {
          setError('Transação não encontrada');
          return false;
        }
      }

      await transactionService.deleteTransaction(transaction);
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      return true;
    } catch (err) {
      console.error('Erro ao deletar transação:', err);
      setError('Erro ao deletar transação');
      return false;
    }
  };

  // Deletar série de transações
  const deleteTransactionSeries = async (seriesId: string): Promise<number> => {
    if (!user?.uid) return 0;
    
    try {
      const deletedCount = await transactionService.deleteTransactionSeries(user.uid, seriesId);
      // Remover todas do estado local que tenham o mesmo seriesId
      setTransactions(prev => prev.filter(t => t.seriesId !== seriesId));
      return deletedCount;
    } catch (err) {
      console.error('Erro ao deletar série:', err);
      setError('Erro ao deletar série de transações');
      return 0;
    }
  };

  // Filtrar por tipo
  // Excluir: transações de cartão (aparecem nas faturas e só impactam quando a fatura é paga)
  // Mas INCLUIR pagamentos de fatura (creditCardBillId), pois são saídas reais da conta
  const incomeTransactions = transactions.filter(t => 
    t.type === 'income' && 
    (!t.creditCardId || t.creditCardBillId)
  );
  const expenseTransactions = transactions.filter(t => 
    t.type === 'expense' && 
    (!t.creditCardId || t.creditCardBillId)
  );
  const transferTransactions = transactions.filter(t => t.type === 'transfer');

  // Calcular totais do mês atual (apenas concluídos para o saldo real)
  // Transações de cartão NÃO são contabilizadas aqui (aparecem via fatura)
  // Pagamentos de fatura (creditCardBillId) SÃO contabilizados como despesa real
  let totalIncome = incomeTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  let totalExpense = expenseTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  // Quando há filtro por conta, transferências afetam o saldo:
  // - Transferência SAINDO da conta filtrada = despesa
  // - Transferência ENTRANDO na conta filtrada = receita
  if (accountId) {
    transferTransactions
      .filter(t => t.status === 'completed')
      .forEach(t => {
        // Transferência saindo desta conta = despesa
        if (t.accountId === accountId) {
          totalExpense += t.amount;
        }
        // Transferência entrando nesta conta = receita
        if (t.toAccountId === accountId) {
          totalIncome += t.amount;
        }
      });
  }

  // Saldo do mês (sem considerar histórico) - apenas lançamentos concluídos
  const monthBalance = totalIncome - totalExpense;
  
  // Saldo total (com histórico acumulado dos meses anteriores)
  const balance = carryOverBalance + monthBalance;

  return {
    transactions,
    incomeTransactions,
    expenseTransactions,
    transferTransactions,
    totalIncome,
    totalExpense,
    monthBalance,      // Saldo apenas deste mês
    carryOverBalance,  // Saldo acumulado de meses anteriores
    balance,           // Saldo total (histórico + mês atual)
    loading,
    error,
    refresh: loadTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    deleteTransactionSeries,
  };
}

// Hook para totais do mês
export function useMonthTotals(month: number, year: number) {
  const { user } = useAuth();
  const { refreshKey } = useTransactionRefresh();
  const [totals, setTotals] = useState({ income: 0, expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTotals = useCallback(async () => {
    if (!user?.uid) {
      setTotals({ income: 0, expense: 0, balance: 0 });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await transactionService.getMonthTotals(user.uid, month, year);
      setTotals(data);
    } catch (err) {
      console.error('Erro ao carregar totais:', err);
      setError('Erro ao carregar totais');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, month, year]);

  useEffect(() => {
    loadTotals();
  }, [loadTotals]);

  // Recarregar quando ocorrerem mudanças globais (criar/editar/excluir/pagar fatura)
  useEffect(() => {
    if (refreshKey > 0) {
      loadTotals();
    }
  }, [refreshKey, loadTotals]);

  return {
    ...totals,
    loading,
    error,
    refresh: loadTotals,
  };
}

// Hook para gastos por categoria
export function useExpensesByCategory(month: number, year: number) {
  const { user } = useAuth();
  const { refreshKey } = useTransactionRefresh();
  const [expenses, setExpenses] = useState<Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    total: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!user?.uid) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await transactionService.getExpensesByCategory(user.uid, month, year);
      const expensesArray = Array.from(data.values())
        .sort((a, b) => b.total - a.total);
      setExpenses(expensesArray);
    } catch (err) {
      console.error('Erro ao carregar gastos por categoria:', err);
      setError('Erro ao carregar gastos por categoria');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, month, year]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Recarregar quando ocorrerem mudanças globais (criar/editar/excluir)
  useEffect(() => {
    if (refreshKey > 0) {
      loadExpenses();
    }
  }, [refreshKey, loadExpenses]);

  const total = expenses.reduce((sum, e) => sum + e.total, 0);

  return {
    expenses,
    total,
    loading,
    error,
    refresh: loadExpenses,
  };
}

// Hook para receitas por categoria
export function useIncomesByCategory(month: number, year: number) {
  const { user } = useAuth();
  const { refreshKey } = useTransactionRefresh();
  const [incomes, setIncomes] = useState<Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    total: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIncomes = useCallback(async () => {
    if (!user?.uid) {
      setIncomes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await transactionService.getIncomesByCategory(user.uid, month, year);
      const incomesArray = Array.from(data.values())
        .sort((a, b) => b.total - a.total);
      setIncomes(incomesArray);
    } catch (err) {
      console.error('Erro ao carregar receitas por categoria:', err);
      setError('Erro ao carregar receitas por categoria');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, month, year]);

  useEffect(() => {
    loadIncomes();
  }, [loadIncomes]);

  // Recarregar quando ocorrerem mudanças globais
  useEffect(() => {
    if (refreshKey > 0) {
      loadIncomes();
    }
  }, [refreshKey, loadIncomes]);

  const total = incomes.reduce((sum, i) => sum + i.total, 0);

  return {
    incomes,
    total,
    loading,
    error,
    refresh: loadIncomes,
  };
}

// Hook para relatório completo do mês
export function useMonthReport(month: number, year: number) {
  const { user } = useAuth();
  const { refreshKey } = useTransactionRefresh();
  const [report, setReport] = useState<{
    income: number;
    expense: number;
    balance: number;
    debitExpenses: number;
    creditExpenses: number;
    currentSalary: number;
    totalCreditCardUsage: number;
    previousMonth: { income: number; expense: number; balance: number };
    debtPercentage: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!user?.uid) {
      setReport(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await transactionService.getMonthReport(user.uid, month, year);
      setReport(data);
    } catch (err) {
      console.error('Erro ao carregar relatório:', err);
      setError('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, month, year]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Recarregar quando ocorrerem mudanças globais (criar/editar/excluir)
  useEffect(() => {
    if (refreshKey > 0) {
      loadReport();
    }
  }, [refreshKey, loadReport]);

  return {
    report,
    loading,
    error,
    refresh: loadReport,
  };
}
