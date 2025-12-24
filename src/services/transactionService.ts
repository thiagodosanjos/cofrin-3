// ==========================================
// SERVIÇO DE TRANSAÇÕES / LANÇAMENTOS
// ==========================================

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where, Timestamp
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import {
    Transaction,
    CreateTransactionInput,
    UpdateTransactionInput,
    TransactionType,
} from '../types/firebase';
import { updateAccountBalance, getAccounts } from './accountService';
import { getCategoryById } from './categoryService';
import { getAccountById } from './accountService';
import { getCreditCardById, updateCreditCardUsage, recalculateCreditCardUsage } from './creditCardService';
import { addToGoalProgress, removeFromGoalProgress } from './goalService';
import { getPendingBillsMap, getCorrectBillForTransaction } from './creditCardBillService';

const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

// ==========================================
// CRIAR TRANSAÇÃO
// ==========================================

export async function createTransaction(
  userId: string,
  data: CreateTransactionInput
): Promise<Transaction> {
  const now = Timestamp.now();
  const transactionDate = data.date.toDate();
  
  // Calcular mês e ano - para cartão de crédito, considerar o dia de fechamento
  let month = transactionDate.getMonth() + 1;
  let year = transactionDate.getFullYear();

  // Buscar dados desnormalizados
  let categoryName: string | undefined;
  let categoryIcon: string | undefined;
  let accountName: string | undefined;
  let toAccountName: string | undefined;
  let creditCardName: string | undefined;

  // Categoria
  if (data.categoryId) {
    const category = await getCategoryById(data.categoryId);
    if (category) {
      categoryName = category.name;
      categoryIcon = category.icon;
    }
  }

  // Cartão de crédito - calcular mês/ano correto da fatura considerando fechamento e fatura paga
  if (data.creditCardId) {
    const card = await getCreditCardById(data.creditCardId);
    if (card) {
      creditCardName = card.name;
      // Usar validação completa que verifica fechamento e se a fatura está paga
      const billInfo = await getCorrectBillForTransaction(
        userId,
        data.creditCardId,
        transactionDate,
        card.closingDay
      );
      month = billInfo.month;
      year = billInfo.year;
    }
  }

  // Conta origem - só buscar se tiver accountId válido
  if (data.accountId) {
    const account = await getAccountById(data.accountId);
    if (account) {
      accountName = account.name;
    }
  }

  // Conta destino (transferência)
  if (data.toAccountId) {
    const toAccount = await getAccountById(data.toAccountId);
    if (toAccount) {
      toAccountName = toAccount.name;
    }
  }

  // Criar transação - construir objeto sem campos undefined
  const transactionData: Record<string, any> = {
    type: data.type,
    amount: data.amount,
    description: data.description,
    date: data.date,
    recurrence: data.recurrence,
    status: data.status,
    userId,
    month,
    year,
    createdAt: now,
    updatedAt: now,
  };

  // Adicionar accountId apenas se tiver valor (não é obrigatório para cartão de crédito)
  if (data.accountId) {
    transactionData.accountId = data.accountId;
    if (accountName) transactionData.accountName = accountName;
  }

  // Adicionar campos opcionais apenas se tiverem valor
  if (data.categoryId) {
    transactionData.categoryId = data.categoryId;
    if (categoryName) transactionData.categoryName = categoryName;
    if (categoryIcon) transactionData.categoryIcon = categoryIcon;
  }
  if (data.toAccountId) {
    transactionData.toAccountId = data.toAccountId;
    if (toAccountName) transactionData.toAccountName = toAccountName;
  }
  if (data.creditCardId) {
    transactionData.creditCardId = data.creditCardId;
    if (creditCardName) transactionData.creditCardName = creditCardName;
  }
  if (data.notes) transactionData.notes = data.notes;
  if (data.tags && data.tags.length > 0) transactionData.tags = data.tags;
  if (data.recurrenceEndDate) transactionData.recurrenceEndDate = data.recurrenceEndDate;
  if (data.parentTransactionId) transactionData.parentTransactionId = data.parentTransactionId;
  if (data.seriesId) transactionData.seriesId = data.seriesId;
  if (data.goalId) transactionData.goalId = data.goalId;
  if (data.goalName) transactionData.goalName = data.goalName;

  const docRef = await addDoc(transactionsRef, transactionData);

  // Atualizar saldos das contas apenas se:
  // - Tiver accountId (não é cartão de crédito sozinho)
  // - Não for transação de cartão de crédito
  // - Status for 'completed'
  if (data.accountId && !data.creditCardId && data.status === 'completed') {
    await updateBalancesForTransaction(data as CreateTransactionInput & { accountId: string });
  }

  // Atualizar uso do cartão de crédito se for transação de cartão
  if (data.creditCardId && data.status === 'completed') {
    // Despesa aumenta o uso, receita (estorno) diminui o uso
    const usageAmount = data.type === 'expense' ? data.amount : -data.amount;
    await updateCreditCardUsage(data.creditCardId, usageAmount);
  }

  // Retornar transação criada (com os mesmos dados salvos)
  return {
    id: docRef.id,
    ...transactionData,
  } as Transaction;
}

// Atualizar saldos das contas baseado na transação
async function updateBalancesForTransaction(
  data: CreateTransactionInput | UpdateTransactionInput & { accountId: string },
  isReverse: boolean = false
): Promise<void> {
  const multiplier = isReverse ? -1 : 1;
  const amount = (data.amount ?? 0) * multiplier;

  switch (data.type) {
    case 'expense':
      // Despesa: subtrai da conta
      await updateAccountBalance(data.accountId!, -amount);
      break;
    case 'income':
      // Receita: adiciona na conta
      await updateAccountBalance(data.accountId!, amount);
      break;
    case 'transfer':
      // Transferência: subtrai da origem, adiciona no destino
      await updateAccountBalance(data.accountId!, -amount);
      if (data.toAccountId) {
        await updateAccountBalance(data.toAccountId, amount);
      }
      break;
  }
}

// ==========================================
// BUSCAR TRANSAÇÕES
// ==========================================

// Buscar transações por mês/ano
export async function getTransactionsByMonth(
  userId: string,
  month: number,
  year: number
): Promise<Transaction[]> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('month', '==', month),
    where('year', '==', year)
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
  
  return transactions.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Buscar transações por período
export async function getTransactionsByPeriod(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(endDate))
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
  
  return transactions.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Buscar transações pendentes futuras (a partir de hoje)
// Nota: filtramos status e data no código para evitar necessidade de índice composto
export async function getPendingFutureTransactions(
  userId: string
): Promise<Transaction[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();

  // Buscar apenas por status=pending (não requer índice composto com userId)
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter(tx => {
      // Filtrar transações com data >= hoje
      const txDate = (tx as Transaction).date?.toDate?.();
      return txDate && txDate.getTime() >= startOfTodayMs;
    }) as Transaction[];
  
  return transactions.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Buscar transações por tipo
export async function getTransactionsByType(
  userId: string,
  type: TransactionType,
  month?: number,
  year?: number
): Promise<Transaction[]> {
  let q;

  if (month && year) {
    q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('type', '==', type),
      where('month', '==', month),
      where('year', '==', year)
    );
  } else {
    q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('type', '==', type)
    );
  }

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
  
  return transactions.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Buscar transações por conta
export async function getTransactionsByAccount(
  userId: string,
  accountId: string,
  month?: number,
  year?: number
): Promise<Transaction[]> {
  // Transações onde a conta é origem
  let q1;
  let q2;

  if (month && year) {
    q1 = query(
      transactionsRef,
      where('userId', '==', userId),
      where('accountId', '==', accountId),
      where('month', '==', month),
      where('year', '==', year)
    );

    // Transações onde a conta é destino (transferências)
    q2 = query(
      transactionsRef,
      where('userId', '==', userId),
      where('toAccountId', '==', accountId),
      where('month', '==', month),
      where('year', '==', year)
    );
  } else {
    q1 = query(
      transactionsRef,
      where('userId', '==', userId),
      where('accountId', '==', accountId)
    );

    q2 = query(
      transactionsRef,
      where('userId', '==', userId),
      where('toAccountId', '==', accountId)
    );
  }

  const [snapshot1, snapshot2] = await Promise.all([
    getDocs(q1),
    getDocs(q2),
  ]);

  const transactions = [
    ...snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    ...snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() })),
  ] as Transaction[];

  // Ordenar por data e remover duplicatas
  return transactions
    .filter((t, index, self) => self.findIndex(x => x.id === t.id) === index)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Buscar transações por cartão de crédito
export async function getTransactionsByCreditCard(
  userId: string,
  creditCardId: string,
  month?: number,
  year?: number
): Promise<Transaction[]> {
  let q;

  if (month && year) {
    q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('creditCardId', '==', creditCardId),
      where('month', '==', month),
      where('year', '==', year)
    );
  } else {
    q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('creditCardId', '==', creditCardId)
    );
  }

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
  
  return transactions.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Buscar transações por meta
export async function getTransactionsByGoal(
  userId: string,
  goalId: string
): Promise<Transaction[]> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('goalId', '==', goalId)
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
  
  return transactions.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Deletar todas as transações de uma meta (para metas não concluídas)
export async function deleteTransactionsByGoal(
  userId: string,
  goalId: string
): Promise<number> {
  const transactions = await getTransactionsByGoal(userId, goalId);
  let deletedCount = 0;

  for (const transaction of transactions) {
    try {
      await deleteTransaction(transaction);
      deletedCount++;
    } catch (error) {
      console.error(`Erro ao deletar transação ${transaction.id}:`, error);
    }
  }

  return deletedCount;
}

// Remover goalId das transações (para metas concluídas - mantém transações mas remove associação)
export async function removeGoalIdFromTransactions(
  userId: string,
  goalId: string
): Promise<number> {
  const transactions = await getTransactionsByGoal(userId, goalId);
  let updatedCount = 0;

  for (const transaction of transactions) {
    try {
      const docRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
      // Remove goalId e goalName mas mantém a transação
      await updateDoc(docRef, {
        goalId: null,
        goalName: null,
        updatedAt: Timestamp.now(),
      });
      updatedCount++;
    } catch (error) {
      console.error(`Erro ao atualizar transação ${transaction.id}:`, error);
    }
  }

  return updatedCount;
}

// Buscar transações recentes
export async function getRecentTransactions(
  userId: string,
  limitCount: number = 10
): Promise<Transaction[]> {
  // Buscar todas do usuário e limitar no cliente
  const q = query(
    transactionsRef,
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
  
  return transactions
    .sort((a, b) => b.date.toMillis() - a.date.toMillis())
    .slice(0, limitCount)
    .reverse();
}

// Buscar transação por ID
export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  const docRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Transaction;
}

// ==========================================
// ATUALIZAR TRANSAÇÃO
// ==========================================

export async function updateTransaction(
  transactionId: string,
  data: UpdateTransactionInput,
  oldTransaction: Transaction
): Promise<void> {
  try {
    // Determinar estados antigos e novos
    const oldWasCompleted = oldTransaction.status === 'completed';
    const newStatus = data.status ?? oldTransaction.status;
    const newWillBeCompleted = newStatus === 'completed';
    
    const oldType = oldTransaction.type;
    const newType = data.type ?? oldTransaction.type;
    
    const oldAmount = oldTransaction.amount;
    const newAmount = data.amount ?? oldTransaction.amount;
    
    const oldAccountId = oldTransaction.accountId;
    const newAccountId = data.accountId !== undefined ? data.accountId : oldTransaction.accountId;
    
    const oldToAccountId = oldTransaction.toAccountId;
    const newToAccountId = data.toAccountId !== undefined ? data.toAccountId : oldTransaction.toAccountId;
    
    const oldCreditCardId = oldTransaction.creditCardId;
    const newCreditCardId = data.creditCardId !== undefined ? data.creditCardId : oldTransaction.creditCardId;

    const oldGoalId = oldTransaction.goalId;
    const hasGoal = !!oldGoalId;

    // ===== REVERTER IMPACTOS DA TRANSAÇÃO ANTIGA =====
    if (oldWasCompleted) {
      // Reverter progresso da meta se tinha goalId e estava completa
      if (hasGoal && oldGoalId) {
        await removeFromGoalProgress(oldGoalId, oldAmount);
      }

      if (oldCreditCardId) {
        // Reverter uso do cartão de crédito antigo
        const oldUsageAmount = oldType === 'expense' ? oldAmount : -oldAmount;
        await updateCreditCardUsage(oldCreditCardId, -oldUsageAmount);
      } else if (oldAccountId) {
        // Reverter saldo da conta antiga
        await updateBalancesForTransaction(
          {
            type: oldType,
            amount: oldAmount,
            accountId: oldAccountId,
            toAccountId: oldToAccountId,
          } as any,
          true // reverse = true
        );
      }
    }

    // ===== ATUALIZAR DOCUMENTO NO FIRESTORE =====
    const docRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    
    const updateData: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };

    // Buscar nomes atualizados se os IDs mudaram
    try {
      // accountName
      if (data.accountId !== undefined && data.accountId !== oldAccountId) {
        if (data.accountId) {
          const account = await getAccountById(data.accountId);
          if (account) {
            updateData.accountName = account.name;
          }
        } else {
          updateData.accountName = null;
        }
      }

      // categoryName e categoryIcon
      if (data.categoryId !== undefined && data.categoryId !== oldTransaction.categoryId) {
        if (data.categoryId) {
          const category = await getCategoryById(data.categoryId);
          if (category) {
            updateData.categoryName = category.name;
            updateData.categoryIcon = category.icon;
          }
        } else {
          updateData.categoryName = null;
          updateData.categoryIcon = null;
        }
      }

      // toAccountName (para transferências)
      if (data.toAccountId !== undefined && data.toAccountId !== oldToAccountId) {
        if (data.toAccountId) {
          const toAccount = await getAccountById(data.toAccountId);
          if (toAccount) {
            updateData.toAccountName = toAccount.name;
          }
        } else {
          updateData.toAccountName = null;
        }
      }

      // creditCardName
      if (data.creditCardId !== undefined && data.creditCardId !== oldCreditCardId) {
        if (data.creditCardId) {
          const creditCard = await getCreditCardById(data.creditCardId);
          if (creditCard) {
            updateData.creditCardName = creditCard.name;
          }
        } else {
          updateData.creditCardName = null;
        }
      }
    } catch (error) {
      console.error('Erro ao buscar nomes durante atualização:', error);
      // Continua mesmo se houver erro ao buscar nomes
    }

    // Atualizar mês/ano se a data mudou
    if (data.date) {
      const transactionDate = data.date.toDate();
      
      // Para cartão de crédito, usar a validação de fatura correta
      const effectiveCreditCardId = data.creditCardId !== undefined ? data.creditCardId : oldCreditCardId;
      if (effectiveCreditCardId) {
        const card = await getCreditCardById(effectiveCreditCardId);
        if (card) {
          const billInfo = await getCorrectBillForTransaction(
            oldTransaction.userId,
            effectiveCreditCardId,
            transactionDate,
            card.closingDay
          );
          updateData.month = billInfo.month;
          updateData.year = billInfo.year;
        } else {
          updateData.month = transactionDate.getMonth() + 1;
          updateData.year = transactionDate.getFullYear();
        }
      } else {
        updateData.month = transactionDate.getMonth() + 1;
        updateData.year = transactionDate.getFullYear();
      }
    }

    // Se está removendo o cartão explicitamente (mudando para conta)
    if (data.creditCardId === null || data.creditCardId === '') {
      updateData.creditCardId = null;
      updateData.creditCardName = null;
    }

    // Remover campos undefined (Firestore não aceita undefined)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await updateDoc(docRef, updateData);

    // ===== APLICAR IMPACTOS DA TRANSAÇÃO NOVA =====
    if (newWillBeCompleted) {
      // Adicionar progresso à meta se tem goalId e ficou completa
      if (hasGoal && oldGoalId) {
        await addToGoalProgress(oldGoalId, newAmount);
      }

      if (newCreditCardId) {
        // Aplicar uso no novo cartão de crédito
        const newUsageAmount = newType === 'expense' ? newAmount : -newAmount;
        await updateCreditCardUsage(newCreditCardId, newUsageAmount);
      } else if (newAccountId) {
        // Aplicar saldo na nova conta
        await updateBalancesForTransaction({
          type: newType,
          amount: newAmount,
          accountId: newAccountId,
          toAccountId: newToAccountId,
        } as any);
      }
    }

    // ===== RECALCULAR USO DO CARTÃO SE A DATA MUDOU DE MÊS =====
    // Se é transação de cartão e a data mudou, recalcular totalmente
    if (oldCreditCardId && data.date) {
      const oldMonth = oldTransaction.month;
      const oldYear = oldTransaction.year;
      const newMonth = updateData.month;
      const newYear = updateData.year;
      
      // Se mudou de mês/ano, recalcular
      if (oldMonth !== newMonth || oldYear !== newYear) {
        await recalculateCreditCardUsage(oldTransaction.userId, oldCreditCardId);
      }
    }
  } catch (error) {
    console.error('❌ ERRO EM updateTransaction:', error);
    console.error('📝 Data recebida:', JSON.stringify(data, null, 2));
    console.error('📦 Transação antiga:', JSON.stringify({
      id: oldTransaction.id,
      type: oldTransaction.type,
      amount: oldTransaction.amount,
      month: oldTransaction.month,
      year: oldTransaction.year,
      accountId: oldTransaction.accountId,
      creditCardId: oldTransaction.creditCardId,
    }, null, 2));
    throw error;
  }
}

// ==========================================
// DELETAR TRANSAÇÃO
// ==========================================

export async function deleteTransaction(transaction: Transaction): Promise<void> {
  // IMPORTANTE: Deletar primeiro para evitar estado inconsistente se falhar por permissão
  const docRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
  await deleteDoc(docRef);

  // Reverter saldos apenas se status era 'completed', não era cartão de crédito E tem accountId
  if (!transaction.creditCardId && transaction.status === 'completed' && transaction.accountId) {
    await updateBalancesForTransaction(
      { ...transaction, type: transaction.type, accountId: transaction.accountId },
      true
    );
  }

  // Se for transação de aporte em meta, decrementar o valor da meta
  if (transaction.goalId && transaction.status === 'completed') {
    await removeFromGoalProgress(transaction.goalId, transaction.amount);
  }

  // Se for transação de cartão de crédito, recalcular o valor usado
  if (transaction.creditCardId && transaction.userId) {
    await recalculateCreditCardUsage(transaction.userId, transaction.creditCardId);
  }
}

// Buscar transações por seriesId
export async function getTransactionsBySeries(
  userId: string,
  seriesId: string
): Promise<Transaction[]> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('seriesId', '==', seriesId)
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
  
  return transactions.sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

// Deletar todas as transações de uma série
// Deletar todas as transações de uma série
// Otimizado com processamento paralelo em chunks para melhor performance
export async function deleteTransactionSeries(
  userId: string,
  seriesId: string,
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const transactions = await getTransactionsBySeries(userId, seriesId);
  
  if (transactions.length === 0) {
    return 0;
  }

  const total = transactions.length;
  let deletedCount = 0;
  
  // Processar em chunks de 5 para paralelização controlada
  const CHUNK_SIZE = 5;
  
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE);
    
    const results = await Promise.allSettled(
      chunk.map(transaction => deleteTransaction(transaction))
    );
    
    deletedCount += results.filter(r => r.status === 'fulfilled').length;
    
    // Reportar progresso
    onProgress?.(Math.min(i + CHUNK_SIZE, total), total);
  }

  return deletedCount;
}

// ==========================================
// MOVER SÉRIE DE TRANSAÇÕES PARCELADAS
// ==========================================

/**
 * Move toda a série de transações parceladas para a próxima fatura
 * Usado quando a fatura original já foi paga
 */
export async function moveTransactionSeriesToNextBill(
  userId: string,
  seriesId: string,
  creditCardId: string
): Promise<{ movedCount: number; newMonth: number; newYear: number }> {
  const transactions = await getTransactionsBySeries(userId, seriesId);
  
  if (transactions.length === 0) {
    throw new Error('Nenhuma transação encontrada na série');
  }

  // Verificar se todas são do mesmo cartão
  const allSameCard = transactions.every(t => t.creditCardId === creditCardId);
  if (!allSameCard) {
    throw new Error('Transações da série pertencem a cartões diferentes');
  }

  // Buscar o cartão para obter dia de fechamento
  const card = await getCreditCardById(creditCardId);
  if (!card) {
    throw new Error('Cartão não encontrado');
  }

  // Pegar a primeira transação para calcular a nova fatura
  const firstTransaction = transactions[0];
  const originalMonth = firstTransaction.month;
  const originalYear = firstTransaction.year;

  // Calcular próxima fatura
  let newMonth = originalMonth + 1;
  let newYear = originalYear;
  if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }

  // Verificar se a próxima fatura também está paga
  const { isBillPaid } = await import('./creditCardBillService');
  const nextBillPaid = await isBillPaid(userId, creditCardId, newMonth, newYear);
  if (nextBillPaid) {
    // Se a próxima também está paga, avançar mais um mês
    newMonth += 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
  }

  // Atualizar todas as transações da série
  let movedCount = 0;
  for (const transaction of transactions) {
    try {
      const docRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
      
      // Calcular nova data mantendo o dia relativo
      const oldDate = transaction.date.toDate();
      const dayOfMonth = oldDate.getDate();
      const monthDiff = (newMonth - originalMonth) + (newYear - originalYear) * 12;
      const newDate = new Date(oldDate);
      newDate.setMonth(newDate.getMonth() + monthDiff);
      
      await updateDoc(docRef, {
        month: newMonth + (transactions.indexOf(transaction)), // Cada parcela em seu mês
        year: newYear + Math.floor((newMonth + transactions.indexOf(transaction) - 1) / 12),
        updatedAt: Timestamp.now(),
      });
      
      movedCount++;
    } catch (error) {
      console.error(`Erro ao mover transação ${transaction.id}:`, error);
    }
  }

  // Recalcular uso do cartão
  await recalculateCreditCardUsage(userId, creditCardId);

  return { movedCount, newMonth, newYear };
}

// ==========================================
// CÁLCULOS / TOTAIS
// ==========================================

// Calcular totais do mês
// LÓGICA DE CONTA CORRENTE:
// - Calcula APENAS a movimentação do mês específico
// - Receitas somam, despesas subtraem
// - Transferências são ignoradas (apenas movem saldo entre contas)
// - Pagamentos de fatura são ignorados (são transferências internas)
// - Transações de cartão com fatura pendente são ignoradas
// - Apenas transações 'completed' entram no cálculo
// - O saldo se propaga, os lançamentos não
export async function getMonthTotals(
  userId: string,
  month: number,
  year: number
): Promise<{ income: number; expense: number; balance: number }> {
  const transactions = await getTransactionsByMonth(userId, month, year);
  
  // Buscar faturas pendentes para excluir transações de cartão com fatura não paga
  const pendingBills = await getPendingBillsMap(userId);
  
  let income = 0;
  let expense = 0;

  for (const t of transactions) {
    if (t.status !== 'completed') continue;
    
    // Ignorar transações de cartão com fatura pendente
    // Essas transações só devem impactar o saldo quando a fatura for paga
    // IMPORTANTE: Pagamentos de fatura (creditCardBillId) NÃO são ignorados,
    // pois representam dinheiro real saindo da conta
    if (t.creditCardId && t.month && t.year) {
      const billKey = `${t.creditCardId}-${t.month}-${t.year}`;
      if (pendingBills.has(billKey)) {
        continue; // Fatura pendente - não conta no saldo realizado
      }
    }
    
    if (t.type === 'income') {
      income += t.amount;
    } else if (t.type === 'expense') {
      expense += t.amount;
    }
  }

  return {
    income,
    expense,
    balance: income - expense,
  };
}

// Buscar gastos por categoria
export async function getExpensesByCategory(
  userId: string,
  month: number,
  year: number
): Promise<Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>> {
  const transactions = await getTransactionsByType(userId, 'expense', month, year);
  
  // Buscar faturas pendentes
  const pendingBills = await getPendingBillsMap(userId);
  
  const byCategory = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>();

  for (const t of transactions) {
    if (t.status !== 'completed' || !t.categoryId) continue;
    
    // Pagamentos de fatura não têm categoria, então já são filtrados pela condição acima
    
    // Ignorar transações de cartão com fatura pendente
    if (t.creditCardId && t.month && t.year) {
      const billKey = `${t.creditCardId}-${t.month}-${t.year}`;
      if (pendingBills.has(billKey)) {
        continue; // Fatura pendente - não conta em despesas
      }
    }

    const existing = byCategory.get(t.categoryId);
    if (existing) {
      existing.total += t.amount;
    } else {
      byCategory.set(t.categoryId, {
        categoryId: t.categoryId,
        categoryName: t.categoryName || 'Sem categoria',
        categoryIcon: t.categoryIcon || 'dots-horizontal',
        total: t.amount,
      });
    }
  }

  return byCategory;
}

// Buscar receitas por categoria
export async function getIncomesByCategory(
  userId: string,
  month: number,
  year: number
): Promise<Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>> {
  const transactions = await getTransactionsByType(userId, 'income', month, year);
  
  const byCategory = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>();

  for (const t of transactions) {
    if (t.status !== 'completed' || !t.categoryId) continue;

    const existing = byCategory.get(t.categoryId);
    if (existing) {
      existing.total += t.amount;
    } else {
      byCategory.set(t.categoryId, {
        categoryId: t.categoryId,
        categoryName: t.categoryName || 'Sem categoria',
        categoryIcon: t.categoryIcon || 'dots-horizontal',
        total: t.amount,
      });
    }
  }

  return byCategory;
}

// Contar transações por categoria
export async function getTransactionCountByCategory(
  userId: string,
  categoryId: string
): Promise<number> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('categoryId', '==', categoryId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// Buscar gastos por categoria para múltiplos meses (para análise temporal)
export async function getCategoryExpensesOverTime(
  userId: string,
  startYear: number,
  endYear: number
): Promise<{
  monthlyData: Array<{
    month: number;
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }>;
  yearlyData: Array<{
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }>;
}> {
  // Buscar todas as transações de despesa do usuário (query mais simples sem índice composto)
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('type', '==', 'expense')
  );

  const snapshot = await getDocs(q);
  const allTransactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];

  // Filtrar por ano no código
  const transactions = allTransactions.filter(t => 
    t.year >= startYear && t.year <= endYear
  );

  // Buscar faturas pendentes
  const pendingBills = await getPendingBillsMap(userId);

  // Agrupar por mês
  const monthlyMap = new Map<string, Transaction[]>();
  const yearlyMap = new Map<number, Transaction[]>();

  for (const t of transactions) {
    if (t.status !== 'completed' || !t.categoryId) continue;
    
    // Pagamentos de fatura não têm categoria, já filtrados acima
    
    // Ignorar transações de cartão com fatura pendente
    if (t.creditCardId && t.month && t.year) {
      const billKey = `${t.creditCardId}-${t.month}-${t.year}`;
      if (pendingBills.has(billKey)) {
        continue; // Fatura pendente - não conta
      }
    }

    // Mensal
    const monthKey = `${t.year}-${String(t.month).padStart(2, '0')}`;
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, []);
    }
    monthlyMap.get(monthKey)!.push(t);

    // Anual
    if (!yearlyMap.has(t.year)) {
      yearlyMap.set(t.year, []);
    }
    yearlyMap.get(t.year)!.push(t);
  }

  // Processar dados mensais
  const monthlyData: Array<{
    month: number;
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }> = [];

  for (const [monthKey, monthTransactions] of monthlyMap.entries()) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const categories = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>();

    for (const t of monthTransactions) {
      const existing = categories.get(t.categoryId!);
      if (existing) {
        existing.total += t.amount;
      } else {
        categories.set(t.categoryId!, {
          categoryId: t.categoryId!,
          categoryName: t.categoryName || 'Sem categoria',
          categoryIcon: t.categoryIcon || 'dots-horizontal',
          total: t.amount,
        });
      }
    }

    monthlyData.push({ month, year, categories });
  }

  // Ordenar mensais por data (mais recente primeiro)
  monthlyData.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  // Processar dados anuais
  const yearlyData: Array<{
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }> = [];

  for (const [year, yearTransactions] of yearlyMap.entries()) {
    const categories = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>();

    for (const t of yearTransactions) {
      const existing = categories.get(t.categoryId!);
      if (existing) {
        existing.total += t.amount;
      } else {
        categories.set(t.categoryId!, {
          categoryId: t.categoryId!,
          categoryName: t.categoryName || 'Sem categoria',
          categoryIcon: t.categoryIcon || 'dots-horizontal',
          total: t.amount,
        });
      }
    }

    yearlyData.push({ year, categories });
  }

  // Ordenar anuais (mais recente primeiro)
  yearlyData.sort((a, b) => b.year - a.year);

  return { monthlyData, yearlyData };
}

// Buscar dados por categoria ao longo do tempo (genérico para despesas ou receitas)
export async function getCategoryDataOverTime(
  userId: string,
  startYear: number,
  endYear: number,
  transactionType: 'expense' | 'income'
): Promise<{
  monthlyData: Array<{
    month: number;
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }>;
  yearlyData: Array<{
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }>;
}> {
  // Buscar todas as transações do tipo especificado
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('type', '==', transactionType)
  );

  const snapshot = await getDocs(q);
  const allTransactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];

  // Filtrar por ano no código
  const transactions = allTransactions.filter(t => 
    t.year >= startYear && t.year <= endYear
  );

  // Buscar faturas pendentes (apenas relevante para despesas)
  const pendingBills = transactionType === 'expense' ? await getPendingBillsMap(userId) : new Map();

  // Agrupar por mês
  const monthlyMap = new Map<string, Transaction[]>();
  const yearlyMap = new Map<number, Transaction[]>();

  for (const t of transactions) {
    if (t.status !== 'completed' || !t.categoryId) continue;
    
    // Ignorar transações de cartão com fatura pendente (apenas despesas)
    if (transactionType === 'expense' && t.creditCardId && t.month && t.year) {
      const billKey = `${t.creditCardId}-${t.month}-${t.year}`;
      if (pendingBills.has(billKey)) {
        continue;
      }
    }

    // Mensal
    const monthKey = `${t.year}-${String(t.month).padStart(2, '0')}`;
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, []);
    }
    monthlyMap.get(monthKey)!.push(t);

    // Anual
    if (!yearlyMap.has(t.year)) {
      yearlyMap.set(t.year, []);
    }
    yearlyMap.get(t.year)!.push(t);
  }

  // Processar dados mensais
  const monthlyData: Array<{
    month: number;
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }> = [];

  for (const [monthKey, monthTransactions] of monthlyMap.entries()) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const categories = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>();

    for (const t of monthTransactions) {
      const existing = categories.get(t.categoryId!);
      if (existing) {
        existing.total += t.amount;
      } else {
        categories.set(t.categoryId!, {
          categoryId: t.categoryId!,
          categoryName: t.categoryName || 'Sem categoria',
          categoryIcon: t.categoryIcon || 'dots-horizontal',
          total: t.amount,
        });
      }
    }

    monthlyData.push({ month, year, categories });
  }

  // Ordenar mensais por data (mais recente primeiro)
  monthlyData.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  // Processar dados anuais
  const yearlyData: Array<{
    year: number;
    categories: Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>;
  }> = [];

  for (const [year, yearTransactions] of yearlyMap.entries()) {
    const categories = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>();

    for (const t of yearTransactions) {
      const existing = categories.get(t.categoryId!);
      if (existing) {
        existing.total += t.amount;
      } else {
        categories.set(t.categoryId!, {
          categoryId: t.categoryId!,
          categoryName: t.categoryName || 'Sem categoria',
          categoryIcon: t.categoryIcon || 'dots-horizontal',
          total: t.amount,
        });
      }
    }

    yearlyData.push({ year, categories });
  }

  // Ordenar anuais (mais recente primeiro)
  yearlyData.sort((a, b) => b.year - a.year);

  return { monthlyData, yearlyData };
}

// ==========================================
// SALDO HISTÓRICO
// ==========================================

// Buscar saldo acumulado até antes de um mês específico
// LÓGICA DE CONTA CORRENTE:
// - Retorna o saldo CONSOLIDADO de todos os meses anteriores
// - Inclui a soma dos saldos iniciais de todas as contas (includeInTotal)
// - Cada movimentação é contada APENAS UMA VEZ
// - Este saldo funciona como "saldo inicial" do mês consultado
// - Pagamentos de fatura não são duplicados
// - Transações de cartão com fatura pendente não entram
// - Transferências são ignoradas (não afetam saldo total)
// NOTA: Idealmente, isso deveria vir de snapshots mensais salvos,
// mas por enquanto recalcula toda vez (funcional, mas não otimizado)
export async function getCarryOverBalance(
  userId: string,
  beforeMonth: number,
  beforeYear: number
): Promise<number> {
  // Buscar todas as contas para obter a soma dos saldos iniciais
  const accounts = await getAccounts(userId);
  const totalInitialBalance = accounts
    .filter(acc => acc.includeInTotal)
    .reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);

  // Buscar TODAS as transações do usuário
  const q = query(
    transactionsRef,
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];

  // Buscar faturas pendentes
  const pendingBills = await getPendingBillsMap(userId);

  // Começar com a soma dos saldos iniciais de todas as contas
  let carryOver = totalInitialBalance;

  for (const t of transactions) {
    // Apenas lançamentos concluídos entram no saldo histórico
    if (t.status !== 'completed') continue;
    
    // Ignorar transações de cartão de crédito (compras)
    // O impacto no saldo bancário é dado pelo PAGAMENTO DA FATURA (creditCardBillId)
    // ou se a fatura ainda não foi paga, o dinheiro ainda está na conta.
    if (t.creditCardId) {
      continue;
    }
    
    // Verificar se a transação é de um mês ANTERIOR ao mês especificado
    const isBeforeMonth = 
      t.year < beforeYear || 
      (t.year === beforeYear && t.month < beforeMonth);
    
    if (isBeforeMonth) {
      if (t.type === 'income') {
        carryOver += t.amount;
      } else if (t.type === 'expense') {
        carryOver -= t.amount;
      }
      // Transferências não afetam o saldo total (apenas movem entre contas)
    }
  }

  return carryOver;
}

// Buscar saldo acumulado de uma CONTA ESPECÍFICA até antes de um mês
// Similar a getCarryOverBalance, mas:
// 1. Considera APENAS transações da conta especificada
// 2. Inclui o saldo inicial (initialBalance) da conta
// 3. Transferências PARA esta conta são positivas
// 4. Transferências DESTA conta são negativas
export async function getAccountCarryOverBalance(
  userId: string,
  accountId: string,
  beforeMonth: number,
  beforeYear: number
): Promise<number> {
  // Buscar a conta para obter o saldo inicial
  const account = await getAccountById(accountId);
  if (!account) {
    console.warn('Conta não encontrada:', accountId);
    return 0;
  }

  // Começar com o saldo inicial da conta
  let carryOver = account.initialBalance || 0;

  // Buscar transações da conta
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('accountId', '==', accountId)
  );

  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];

  // Buscar também transferências PARA esta conta
  const qToAccount = query(
    transactionsRef,
    where('userId', '==', userId),
    where('toAccountId', '==', accountId)
  );

  const snapshotToAccount = await getDocs(qToAccount);
  const transfersToAccount = snapshotToAccount.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];

  for (const t of transactions) {
    // Apenas lançamentos concluídos
    if (t.status !== 'completed') continue;
    
    // Ignorar transações de cartão de crédito (elas não afetam a conta diretamente)
    if (t.creditCardId) continue;
    
    // Verificar se é de um mês ANTERIOR
    const isBeforeMonth = 
      t.year < beforeYear || 
      (t.year === beforeYear && t.month < beforeMonth);
    
    if (isBeforeMonth) {
      if (t.type === 'income') {
        carryOver += t.amount;
      } else if (t.type === 'expense') {
        carryOver -= t.amount;
      } else if (t.type === 'transfer') {
        // Transferência DESTA conta = saída
        carryOver -= t.amount;
      }
    }
  }

  // Adicionar transferências PARA esta conta
  for (const t of transfersToAccount) {
    if (t.status !== 'completed') continue;
    
    const isBeforeMonth = 
      t.year < beforeYear || 
      (t.year === beforeYear && t.month < beforeMonth);
    
    if (isBeforeMonth && t.type === 'transfer') {
      // Transferência PARA esta conta = entrada
      carryOver += t.amount;
    }
  }

  return carryOver;
}

// ==========================================
// AJUSTE DE SALDO
// ==========================================

// Criar transação de ajuste de saldo
export async function createBalanceAdjustment(
  userId: string,
  accountId: string,
  accountName: string,
  oldBalance: number,
  newBalance: number
): Promise<Transaction | null> {
  const difference = newBalance - oldBalance;
  
  if (difference === 0) return null; // Sem mudança
  
  const now = Timestamp.now();
  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const adjustmentType: TransactionType = difference > 0 ? 'income' : 'expense';
  const amount = Math.abs(difference);

  const docRef = await addDoc(transactionsRef, {
    userId,
    type: adjustmentType,
    amount,
    description: `Ajuste de saldo${difference > 0 ? ' (crédito)' : ' (débito)'}`,
    date: now,
    month,
    year,
    accountId,
    accountName,
    recurrence: 'none',
    status: 'completed',
    isAdjustment: true, // Marca como ajuste de saldo
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    userId,
    type: adjustmentType,
    amount,
    description: `Ajuste de saldo${difference > 0 ? ' (crédito)' : ' (débito)'}`,
    date: now,
    month,
    year,
    accountId,
    accountName,
    recurrence: 'none',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  } as Transaction;
}

// ==========================================
// DELETAR TRANSAÇÕES POR CONTA
// ==========================================

// Deletar todas as transações de uma conta específica
// Otimizado com processamento paralelo em chunks para melhor performance
export async function deleteTransactionsByAccount(
  userId: string,
  accountId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ deleted: number; error?: string }> {
  try {
    // Buscar apenas transações onde a conta é ORIGEM:
    // - accountId = a conta sendo deletada/resetada
    // IMPORTANTE: NÃO deletar transferências onde a conta é DESTINO (toAccountId),
    // pois o dinheiro já foi transferido e pertence à conta destino
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('accountId', '==', accountId)
    );

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];

    if (transactions.length === 0) {
      return { deleted: 0 };
    }

    const total = transactions.length;
    let deleted = 0;
    
    // Processar em chunks de 5 para paralelização controlada
    // Mantém a lógica de deleteTransaction que reverte saldos
    const CHUNK_SIZE = 5;
    
    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = transactions.slice(i, i + CHUNK_SIZE);
      
      // Processar chunk em paralelo
      const results = await Promise.allSettled(
        chunk.map(transaction => deleteTransaction(transaction))
      );
      
      // Contar sucessos
      deleted += results.filter(r => r.status === 'fulfilled').length;
      
      // Reportar progresso
      onProgress?.(Math.min(i + CHUNK_SIZE, total), total);
    }

    return { deleted };
  } catch (error) {
    console.error('Erro ao deletar transações da conta:', error);
    return { deleted: 0, error: 'Erro ao deletar transações' };
  }
}

// Contar transações de uma conta
export async function countTransactionsByAccount(
  userId: string,
  accountId: string
): Promise<number> {
  // Contar apenas transações onde a conta é ORIGEM (accountId)
  // Não contar transferências onde a conta é apenas destino (toAccountId)
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('accountId', '==', accountId)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ==========================================
// ATUALIZAR NOMES DESNORMALIZADOS
// ==========================================

/**
 * Atualiza o nome do cartão de crédito em todas as transações associadas
 * Usado quando o usuário renomeia um cartão
 */
export async function updateCreditCardNameInTransactions(
  userId: string,
  creditCardId: string,
  newName: string
): Promise<number> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('creditCardId', '==', creditCardId)
  );

  const snapshot = await getDocs(q);
  let updatedCount = 0;

  for (const docSnapshot of snapshot.docs) {
    try {
      await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, docSnapshot.id), {
        creditCardName: newName,
        updatedAt: Timestamp.now(),
      });
      updatedCount++;
    } catch (error) {
      console.error(`Erro ao atualizar transação ${docSnapshot.id}:`, error);
    }
  }

  return updatedCount;
}

// ==========================================
// CARTÃO DE CRÉDITO - AJUSTE E RESET
// ==========================================

// Criar transação de ajuste de uso do cartão de crédito
export async function createCreditCardAdjustment(
  userId: string,
  creditCardId: string,
  creditCardName: string,
  oldUsed: number,
  newUsed: number
): Promise<Transaction | null> {
  const difference = newUsed - oldUsed;
  
  if (difference === 0) return null; // Sem mudança
  
  const now = Timestamp.now();
  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  // Se aumentou o uso, é uma despesa; se diminuiu, é um estorno/ajuste
  const adjustmentType: TransactionType = difference > 0 ? 'expense' : 'income';
  const amount = Math.abs(difference);

  const docRef = await addDoc(transactionsRef, {
    userId,
    type: adjustmentType,
    amount,
    description: `Ajuste de fatura${difference > 0 ? ' (débito)' : ' (estorno)'}`,
    date: now,
    month,
    year,
    creditCardId,
    creditCardName,
    recurrence: 'none',
    status: 'completed',
    isAdjustment: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    userId,
    type: adjustmentType,
    amount,
    description: `Ajuste de fatura${difference > 0 ? ' (débito)' : ' (estorno)'}`,
    date: now,
    month,
    year,
    creditCardId,
    creditCardName,
    recurrence: 'none',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  } as Transaction;
}

// Deletar todas as transações de um cartão de crédito
export async function deleteTransactionsByCreditCard(
  userId: string,
  creditCardId: string
): Promise<{ deleted: number; error?: string }> {
  try {
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      where('creditCardId', '==', creditCardId)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return { deleted: 0 };
    }

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Recalcular o valor usado do cartão após deletar todas as transações
    await recalculateCreditCardUsage(userId, creditCardId);

    return { deleted: snapshot.docs.length };
  } catch (error) {
    console.error('Erro ao deletar transações do cartão:', error);
    return { deleted: 0, error: 'Erro ao deletar transações' };
  }
}

// Contar transações de um cartão de crédito
export async function countTransactionsByCreditCard(
  userId: string,
  creditCardId: string
): Promise<number> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('creditCardId', '==', creditCardId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.length;
}

// ==========================================
// RELATÓRIOS E ANÁLISES
// ==========================================

// Gastos no débito (despesas sem cartão de crédito)
export async function getDebitExpenses(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  const transactions = await getTransactionsByType(userId, 'expense', month, year);
  
  return transactions
    .filter(t => 
      t.status === 'completed' && 
      !t.creditCardId
      // Pagamentos de fatura (creditCardBillId) são incluídos nas despesas da conta
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

// Gastos no crédito (despesas com cartão de crédito)
export async function getCreditExpenses(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  const transactions = await getTransactionsByType(userId, 'expense', month, year);
  
  return transactions
    .filter(t => t.status === 'completed' && t.creditCardId)
    .reduce((sum, t) => sum + t.amount, 0);
}

// Buscar renda atual (soma de todas as receitas do mês atual)
export async function getCurrentSalary(userId: string): Promise<number> {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();

  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('type', '==', 'income'),
    where('month', '==', currentMonth),
    where('year', '==', currentYear),
    where('status', '==', 'completed')
  );

  const snapshot = await getDocs(q);
  const incomeTransactions = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];

  // Somar todas as receitas completadas do mês
  return incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
}

// Gastos futuros previstos (transações pendentes ou recorrentes para próximo mês)
export async function getPredictedExpenses(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  const transactions = await getTransactionsByType(userId, 'expense', month, year);
  
  // Soma todas as despesas (pendentes + concluídas) como previsão
  return transactions
    .filter(t => t.status !== 'cancelled')
    .reduce((sum, t) => sum + t.amount, 0);
}

// Total de uso de cartões de crédito (fatura prevista)
export async function getTotalCreditCardUsage(userId: string): Promise<number> {
  // Importar a função para buscar cartões
  const { getAllCreditCards } = await import('./creditCardService');
  const cards = await getAllCreditCards(userId);
  
  return cards
    .filter(card => !card.isArchived)
    .reduce((sum, card) => sum + (card.currentUsed || 0), 0);
}

// Saldo do mês anterior
export async function getPreviousMonthBalance(
  userId: string,
  currentMonth: number,
  currentYear: number
): Promise<{ income: number; expense: number; balance: number }> {
  // Calcular mês anterior
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = currentYear - 1;
  }

  return getMonthTotals(userId, prevMonth, prevYear);
}

// Relatório completo do mês
export async function getMonthReport(
  userId: string,
  month: number,
  year: number
): Promise<{
  income: number;
  expense: number;
  balance: number;
  debitExpenses: number;
  creditExpenses: number;
  currentSalary: number;
  totalCreditCardUsage: number;
  previousMonth: { income: number; expense: number; balance: number };
  debtPercentage: number;
}> {
  const [
    totals,
    debitExpenses,
    creditExpenses,
    currentSalary,
    totalCreditCardUsage,
    previousMonth
  ] = await Promise.all([
    getMonthTotals(userId, month, year),
    getDebitExpenses(userId, month, year),
    getCreditExpenses(userId, month, year),
    getCurrentSalary(userId),
    getTotalCreditCardUsage(userId),
    getPreviousMonthBalance(userId, month, year)
  ]);

  // Percentual de dívida em cartão sobre salário
  const debtPercentage = currentSalary > 0 
    ? (totalCreditCardUsage / currentSalary) * 100 
    : 0;

  return {
    ...totals,
    debitExpenses,
    creditExpenses,
    currentSalary,
    totalCreditCardUsage,
    previousMonth,
    debtPercentage
  };
}

// ==========================================
// MOVIMENTAÇÃO DE TRANSAÇÕES ENTRE FATURAS
// ==========================================

/**
 * Obtém o último dia válido de um mês
 * @param month Mês (1-12)
 * @param year Ano
 * @returns Último dia do mês (28-31)
 */
function getLastDayOfMonth(month: number, year: number): number {
  // new Date(year, month, 0) retorna o último dia do mês anterior
  return new Date(year, month, 0).getDate();
}

/**
 * Ajusta o dia para o último dia válido do mês de destino
 * Exemplo: dia 31 em um mês com 30 dias → retorna 30
 * @param day Dia original
 * @param targetMonth Mês de destino (1-12)
 * @param targetYear Ano de destino
 * @returns Dia ajustado
 */
function adjustDayForMonth(day: number, targetMonth: number, targetYear: number): number {
  const lastDay = getLastDayOfMonth(targetMonth, targetYear);
  return Math.min(day, lastDay);
}

/**
 * Move uma transação de cartão de crédito para o mês anterior
 * Mantém o dia da transação, ajustando se necessário (ex: 31 → 30)
 * @param transactionId ID da transação a ser movida
 * @throws Error se a transação não for de cartão de crédito
 */
export async function moveTransactionToPreviousBill(transactionId: string): Promise<void> {
  const docRef = doc(transactionsRef, transactionId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    throw new Error('Transação não encontrada');
  }

  const transaction = { id: snapshot.id, ...snapshot.data() } as Transaction;

  // Validar que é uma transação de cartão
  if (!transaction.creditCardId) {
    throw new Error('Apenas transações de cartão de crédito podem ser movidas entre faturas');
  }

  // Armazenar valores originais antes de atualizar
  const originalMonth = transaction.month;
  const originalYear = transaction.year;
  const creditCardId = transaction.creditCardId;

  // Calcular mês/ano anterior
  let newMonth = transaction.month - 1;
  let newYear = transaction.year;
  
  if (newMonth < 1) {
    newMonth = 12;
    newYear -= 1;
  }

  // Obter o dia atual da transação
  const currentDate = transaction.date.toDate();
  const day = currentDate.getDate();
  
  // Ajustar dia se necessário (ex: 31 de março → 28/29 de fevereiro)
  const adjustedDay = adjustDayForMonth(day, newMonth, newYear);
  
  // Criar nova data mantendo hora/minuto/segundo
  const newDate = new Date(
    newYear,
    newMonth - 1, // JavaScript usa mês 0-indexed
    adjustedDay,
    currentDate.getHours(),
    currentDate.getMinutes(),
    currentDate.getSeconds(),
    currentDate.getMilliseconds()
  );

  // Atualizar transação
  await updateDoc(docRef, {
    date: Timestamp.fromDate(newDate),
    month: newMonth,
    year: newYear,
    updatedAt: Timestamp.now(),
  });

  // Recalcular uso do cartão (recalcula todas as transações do cartão)
  await recalculateCreditCardUsage(transaction.userId, creditCardId);
}

/**
 * Move uma transação de cartão de crédito para o próximo mês
 * Mantém o dia da transação, ajustando se necessário (ex: 31 → 30)
 * @param transactionId ID da transação a ser movida
 * @throws Error se a transação não for de cartão de crédito
 */
export async function moveTransactionToNextBill(transactionId: string): Promise<void> {
  const docRef = doc(transactionsRef, transactionId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    throw new Error('Transação não encontrada');
  }

  const transaction = { id: snapshot.id, ...snapshot.data() } as Transaction;

  // Validar que é uma transação de cartão
  if (!transaction.creditCardId) {
    throw new Error('Apenas transações de cartão de crédito podem ser movidas entre faturas');
  }

  // Armazenar valores originais antes de atualizar
  const originalMonth = transaction.month;
  const originalYear = transaction.year;
  const creditCardId = transaction.creditCardId;

  // Calcular próximo mês/ano
  let newMonth = transaction.month + 1;
  let newYear = transaction.year;
  
  if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }

  // Obter o dia atual da transação
  const currentDate = transaction.date.toDate();
  const day = currentDate.getDate();
  
  // Ajustar dia se necessário (ex: 31 de janeiro → 28/29 de fevereiro)
  const adjustedDay = adjustDayForMonth(day, newMonth, newYear);
  
  // Criar nova data mantendo hora/minuto/segundo
  const newDate = new Date(
    newYear,
    newMonth - 1, // JavaScript usa mês 0-indexed
    adjustedDay,
    currentDate.getHours(),
    currentDate.getMinutes(),
    currentDate.getSeconds(),
    currentDate.getMilliseconds()
  );

  // Atualizar transação
  await updateDoc(docRef, {
    date: Timestamp.fromDate(newDate),
    month: newMonth,
    year: newYear,
    updatedAt: Timestamp.now(),
  });

  // Recalcular uso do cartão (recalcula todas as transações do cartão)
  await recalculateCreditCardUsage(transaction.userId, creditCardId);
}
