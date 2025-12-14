// ==========================================
// HOOK DE TRANSAÇÕES
// ==========================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/authContext';
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
        // Buscar por conta
        data = await transactionService.getTransactionsByAccount(user.uid, accountId);
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
        const carryOver = await transactionService.getCarryOverBalance(
          user.uid,
          targetMonth,
          targetYear
        );
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
      const oldTransaction = transactions.find(t => t.id === transactionId);
      if (!oldTransaction) {
        setError('Transação não encontrada');
        return false;
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
      const transaction = transactions.find(t => t.id === transactionId);
      if (!transaction) {
        setError('Transação não encontrada');
        return false;
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
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const transferTransactions = transactions.filter(t => t.type === 'transfer');

  // Calcular totais do mês atual (apenas concluídos para o saldo real)
  const totalIncome = incomeTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = expenseTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

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

  const total = expenses.reduce((sum, e) => sum + e.total, 0);

  return {
    expenses,
    total,
    loading,
    error,
    refresh: loadExpenses,
  };
}
