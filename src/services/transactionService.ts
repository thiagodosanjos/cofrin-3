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
import { updateAccountBalance } from './accountService';
import { getCategoryById } from './categoryService';
import { getAccountById } from './accountService';
import { getCreditCardById } from './creditCardService';

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
  const month = transactionDate.getMonth() + 1;
  const year = transactionDate.getFullYear();

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

  // Conta origem
  const account = await getAccountById(data.accountId);
  if (account) {
    accountName = account.name;
  }

  // Conta destino (transferência)
  if (data.toAccountId) {
    const toAccount = await getAccountById(data.toAccountId);
    if (toAccount) {
      toAccountName = toAccount.name;
    }
  }

  // Cartão de crédito
  if (data.creditCardId) {
    const card = await getCreditCardById(data.creditCardId);
    if (card) {
      creditCardName = card.name;
    }
  }

  // Criar transação - construir objeto sem campos undefined
  const transactionData: Record<string, any> = {
    type: data.type,
    amount: data.amount,
    description: data.description,
    date: data.date,
    accountId: data.accountId,
    recurrence: data.recurrence,
    status: data.status,
    userId,
    month,
    year,
    createdAt: now,
    updatedAt: now,
  };

  // Adicionar campos opcionais apenas se tiverem valor
  if (data.categoryId) {
    transactionData.categoryId = data.categoryId;
    if (categoryName) transactionData.categoryName = categoryName;
    if (categoryIcon) transactionData.categoryIcon = categoryIcon;
  }
  if (accountName) transactionData.accountName = accountName;
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

  const docRef = await addDoc(transactionsRef, transactionData);

  // Atualizar saldos das contas (se não for no cartão de crédito)
  if (!data.creditCardId) {
    await updateBalancesForTransaction(data);
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
  
  return transactions.sort((a, b) => b.date.toMillis() - a.date.toMillis());
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
  
  return transactions.sort((a, b) => b.date.toMillis() - a.date.toMillis());
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
  
  return transactions.sort((a, b) => b.date.toMillis() - a.date.toMillis());
}

// Buscar transações por conta
export async function getTransactionsByAccount(
  userId: string,
  accountId: string
): Promise<Transaction[]> {
  // Transações onde a conta é origem
  const q1 = query(
    transactionsRef,
    where('userId', '==', userId),
    where('accountId', '==', accountId)
  );

  // Transações onde a conta é destino (transferências)
  const q2 = query(
    transactionsRef,
    where('userId', '==', userId),
    where('toAccountId', '==', accountId)
  );

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
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());
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
  
  return transactions.sort((a, b) => b.date.toMillis() - a.date.toMillis());
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
    .slice(0, limitCount);
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
  // Reverter saldos antigos
  if (!oldTransaction.creditCardId) {
    await updateBalancesForTransaction(
      { ...oldTransaction, type: oldTransaction.type },
      true
    );
  }

  // Atualizar transação
  const docRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
  
  const updateData: any = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  // Atualizar mês/ano se a data mudou
  if (data.date) {
    const transactionDate = data.date.toDate();
    updateData.month = transactionDate.getMonth() + 1;
    updateData.year = transactionDate.getFullYear();
  }

  await updateDoc(docRef, updateData);

  // Aplicar novos saldos
  const newData = { ...oldTransaction, ...data };
  if (!newData.creditCardId) {
    await updateBalancesForTransaction(newData as any);
  }
}

// ==========================================
// DELETAR TRANSAÇÃO
// ==========================================

export async function deleteTransaction(transaction: Transaction): Promise<void> {
  // Reverter saldos
  if (!transaction.creditCardId) {
    await updateBalancesForTransaction(
      { ...transaction, type: transaction.type },
      true
    );
  }

  // Deletar transação
  const docRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
  await deleteDoc(docRef);
}

// ==========================================
// CÁLCULOS / TOTAIS
// ==========================================

// Calcular totais do mês
export async function getMonthTotals(
  userId: string,
  month: number,
  year: number
): Promise<{ income: number; expense: number; balance: number }> {
  const transactions = await getTransactionsByMonth(userId, month, year);
  
  let income = 0;
  let expense = 0;

  for (const t of transactions) {
    if (t.status === 'cancelled') continue;
    
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
  
  const byCategory = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string; total: number }>();

  for (const t of transactions) {
    if (t.status === 'cancelled' || !t.categoryId) continue;

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
