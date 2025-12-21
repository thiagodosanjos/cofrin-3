// ==========================================
// HOOK DE CARTÕES DE CRÉDITO
// ==========================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/authContext';
import { useTransactionRefresh } from '../contexts/transactionRefreshContext';
import {
    CreditCard,
    CreateCreditCardInput,
    UpdateCreditCardInput,
    CreditCardBill,
} from '../types/firebase';
import * as creditCardService from '../services/creditCardService';
import { deleteTransactionsByCreditCard } from '../services/transactionService';

export function useCreditCards(includeArchived: boolean = false) {
  const { user } = useAuth();
  const { refreshKey } = useTransactionRefresh();
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar cartões
  const loadCreditCards = useCallback(async () => {
    if (!user?.uid) {
      setCreditCards([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = includeArchived
        ? await creditCardService.getAllCreditCards(user.uid)
        : await creditCardService.getCreditCards(user.uid);

      setCreditCards(data);
    } catch (err) {
      console.error('Erro ao carregar cartões:', err);
      setError('Erro ao carregar cartões');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, includeArchived]);

  // Carregar ao montar e quando refreshKey mudar
  useEffect(() => {
    loadCreditCards();
  }, [loadCreditCards, refreshKey]);

  // Criar cartão
  const createCreditCard = async (data: CreateCreditCardInput): Promise<CreditCard | null> => {
    if (!user?.uid) return null;

    try {
      const newCard = await creditCardService.createCreditCard(user.uid, data);
      setCreditCards(prev => [...prev, newCard].sort((a, b) => a.name.localeCompare(b.name)));
      return newCard;
    } catch (err) {
      console.error('Erro ao criar cartão:', err);
      setError('Erro ao criar cartão');
      return null;
    }
  };

  // Atualizar cartão
  const updateCreditCard = async (cardId: string, data: UpdateCreditCardInput): Promise<boolean> => {
    try {
      await creditCardService.updateCreditCard(cardId, data);
      setCreditCards(prev =>
        prev.map(card => card.id === cardId ? { ...card, ...data } : card)
      );
      return true;
    } catch (err) {
      console.error('Erro ao atualizar cartão:', err);
      setError('Erro ao atualizar cartão');
      return false;
    }
  };

  // Arquivar cartão
  const archiveCreditCard = async (cardId: string): Promise<boolean> => {
    try {
      await creditCardService.archiveCreditCard(cardId);
      if (includeArchived) {
        setCreditCards(prev =>
          prev.map(card => card.id === cardId ? { ...card, isArchived: true } : card)
        );
      } else {
        setCreditCards(prev => prev.filter(card => card.id !== cardId));
      }
      return true;
    } catch (err) {
      console.error('Erro ao arquivar cartão:', err);
      setError('Erro ao arquivar cartão');
      return false;
    }
  };

  // Desarquivar cartão
  const unarchiveCreditCard = async (cardId: string): Promise<boolean> => {
    try {
      await creditCardService.unarchiveCreditCard(cardId);
      setCreditCards(prev =>
        prev.map(card => card.id === cardId ? { ...card, isArchived: false } : card)
      );
      return true;
    } catch (err) {
      console.error('Erro ao desarquivar cartão:', err);
      setError('Erro ao desarquivar cartão');
      return false;
    }
  };

  // Deletar cartão
  const deleteCreditCard = async (cardId: string): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      // Ao excluir o cartão, excluir também todos os lançamentos vinculados a ele
      await deleteTransactionsByCreditCard(user.uid, cardId);
      await creditCardService.deleteCreditCard(cardId, user.uid);
      setCreditCards(prev => prev.filter(card => card.id !== cardId));
      return true;
    } catch (err) {
      console.error('Erro ao deletar cartão:', err);
      setError('Erro ao deletar cartão');
      return false;
    }
  };

  // Cartões ativos
  const activeCards = creditCards.filter(card => !card.isArchived);
  const archivedCards = creditCards.filter(card => card.isArchived);

  // Calcular limite total
  const totalLimit = activeCards.reduce((total, card) => total + card.limit, 0);

  return {
    creditCards,
    activeCards,
    archivedCards,
    totalLimit,
    loading,
    error,
    refresh: loadCreditCards,
    createCreditCard,
    updateCreditCard,
    archiveCreditCard,
    unarchiveCreditCard,
    deleteCreditCard,
  };
}

// Hook para faturas de um mês específico
export function useCreditCardBills(month: number, year: number) {
  const { user } = useAuth();
  const [bills, setBills] = useState<CreditCardBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    if (!user?.uid) {
      setBills([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await creditCardService.getBillsByMonth(user.uid, month, year);
      setBills(data);
    } catch (err) {
      console.error('Erro ao carregar faturas:', err);
      setError('Erro ao carregar faturas');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, month, year]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const totalBills = bills.reduce((total, bill) => total + bill.totalAmount, 0);
  const pendingBills = bills.filter(bill => !bill.isPaid);
  const paidBills = bills.filter(bill => bill.isPaid);

  return {
    bills,
    pendingBills,
    paidBills,
    totalBills,
    loading,
    error,
    refresh: loadBills,
  };
}
