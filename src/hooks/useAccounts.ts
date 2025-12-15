// ==========================================
// HOOK DE CONTAS
// ==========================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/authContext';
import {
    Account,
    CreateAccountInput,
    UpdateAccountInput,
} from '../types/firebase';
import * as accountService from '../services/accountService';

export function useAccounts(includeArchived: boolean = false) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar contas
  const loadAccounts = useCallback(async () => {
    if (!user?.uid) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = includeArchived
        ? await accountService.getAllAccounts(user.uid)
        : await accountService.getAccounts(user.uid);

      setAccounts(data);
    } catch (err) {
      console.error('Erro ao carregar contas:', err);
      setError('Erro ao carregar contas');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, includeArchived]);

  // Carregar ao montar
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Criar conta
  const createAccount = async (data: CreateAccountInput): Promise<Account | null> => {
    if (!user?.uid) return null;

    try {
      const newAccount = await accountService.createAccount(user.uid, data);
      setAccounts(prev => [...prev, newAccount].sort((a, b) => a.name.localeCompare(b.name)));
      return newAccount;
    } catch (err) {
      console.error('Erro ao criar conta:', err);
      setError('Erro ao criar conta');
      return null;
    }
  };

  // Atualizar conta
  const updateAccount = async (accountId: string, data: UpdateAccountInput): Promise<boolean> => {
    try {
      await accountService.updateAccount(accountId, data);
      setAccounts(prev =>
        prev.map(acc => acc.id === accountId ? { ...acc, ...data } : acc)
      );
      return true;
    } catch (err) {
      console.error('Erro ao atualizar conta:', err);
      setError('Erro ao atualizar conta');
      return false;
    }
  };

  // Arquivar conta
  const archiveAccount = async (accountId: string): Promise<boolean> => {
    try {
      await accountService.archiveAccount(accountId);
      if (includeArchived) {
        setAccounts(prev =>
          prev.map(acc => acc.id === accountId ? { ...acc, isArchived: true } : acc)
        );
      } else {
        setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      }
      return true;
    } catch (err) {
      console.error('Erro ao arquivar conta:', err);
      setError('Erro ao arquivar conta');
      return false;
    }
  };

  // Desarquivar conta
  const unarchiveAccount = async (accountId: string): Promise<boolean> => {
    try {
      await accountService.unarchiveAccount(accountId);
      setAccounts(prev =>
        prev.map(acc => acc.id === accountId ? { ...acc, isArchived: false } : acc)
      );
      return true;
    } catch (err) {
      console.error('Erro ao desarquivar conta:', err);
      setError('Erro ao desarquivar conta');
      return false;
    }
  };

  // Deletar conta
  const deleteAccount = async (accountId: string): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      await accountService.deleteAccount(accountId, user.uid);
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      return true;
    } catch (err) {
      console.error('Erro ao deletar conta:', err);
      setError('Erro ao deletar conta');
      return false;
    }
  };

  // Calcular saldo total
  const totalBalance = accounts
    .filter(acc => acc.includeInTotal && !acc.isArchived)
    .reduce((total, acc) => total + acc.balance, 0);

  // Contas ativas
  const activeAccounts = accounts.filter(acc => !acc.isArchived);
  const archivedAccounts = accounts.filter(acc => acc.isArchived);

  return {
    accounts,
    activeAccounts,
    archivedAccounts,
    totalBalance,
    loading,
    error,
    refresh: loadAccounts,
    createAccount,
    updateAccount,
    archiveAccount,
    unarchiveAccount,
    deleteAccount,
  };
}
