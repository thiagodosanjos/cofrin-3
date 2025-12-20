// ==========================================
// SERVIÇO DE CONTAS
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
    where, Timestamp,
    increment
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import {
    Account,
    CreateAccountInput,
    UpdateAccountInput,
} from '../types/firebase';

const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

// Criar conta
export async function createAccount(
  userId: string,
  data: CreateAccountInput
): Promise<Account> {
  const now = Timestamp.now();
  const balance = data.balance ?? data.initialBalance;

  const docRef = await addDoc(accountsRef, {
    ...data,
    balance,
    userId,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    userId,
    ...data,
    balance,
    createdAt: now,
    updatedAt: now,
  } as Account;
}

// Buscar todas as contas do usuário
export async function getAccounts(userId: string): Promise<Account[]> {
  const q = query(
    accountsRef,
    where('userId', '==', userId),
    where('isArchived', '==', false)
  );

  const snapshot = await getDocs(q);
  const accounts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Account[];
  
  return accounts.sort((a, b) => a.name.localeCompare(b.name));
}

// Buscar todas as contas (incluindo arquivadas)
export async function getAllAccounts(userId: string): Promise<Account[]> {
  const q = query(
    accountsRef,
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  const accounts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Account[];
  
  return accounts.sort((a, b) => a.name.localeCompare(b.name));
}

// Buscar conta por ID
export async function getAccountById(accountId: string): Promise<Account | null> {
  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Account;
}

// Atualizar conta
export async function updateAccount(
  accountId: string,
  data: UpdateAccountInput
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Atualizar saldo da conta
export async function updateAccountBalance(
  accountId: string,
  amount: number, // positivo para adicionar, negativo para subtrair
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await updateDoc(docRef, {
    balance: increment(amount),
    updatedAt: Timestamp.now(),
  });
}

// Definir saldo da conta (para ajustes manuais)
export async function setAccountBalance(
  accountId: string,
  newBalance: number
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await updateDoc(docRef, {
    balance: newBalance,
    updatedAt: Timestamp.now(),
  });
}

// Arquivar conta
export async function archiveAccount(accountId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await updateDoc(docRef, {
    isArchived: true,
    updatedAt: Timestamp.now(),
  });
}

// Desarquivar conta
export async function unarchiveAccount(accountId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await updateDoc(docRef, {
    isArchived: false,
    updatedAt: Timestamp.now(),
  });
}

// Deletar conta (permanentemente)
export async function deleteAccount(accountId: string, userId?: string): Promise<void> {
  // Se houver userId, deletar também os lançamentos associados à conta (inclui transferências)
  if (userId) {
    // Import dinâmico para evitar ciclo de dependência
    const { deleteTransactionsByAccount } = await import('./transactionService');
    await deleteTransactionsByAccount(userId, accountId);
  }
  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await deleteDoc(docRef);
}

// Calcular saldo total das contas
export async function getTotalBalance(userId: string): Promise<number> {
  const accounts = await getAccounts(userId);
  return accounts
    .filter(acc => acc.includeInTotal)
    .reduce((total, acc) => total + acc.balance, 0);
}

// Criar conta padrão para novo usuário
export async function createDefaultAccount(userId: string): Promise<Account> {
  const now = Timestamp.now();
  const defaultAccountData = {
    name: 'Conta principal',
    type: 'checking' as const,
    balance: 0,
    initialBalance: 0,
    icon: 'wallet',
    includeInTotal: true,
    isArchived: false,
    isDefault: true,
    initialBalanceSet: false,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(accountsRef, defaultAccountData);

  return {
    id: docRef.id,
    ...defaultAccountData,
  } as Account;
}

// Definir saldo inicial da conta padrão (apenas uma vez)
export async function setInitialBalance(
  accountId: string,
  initialBalance: number
): Promise<void> {
  const account = await getAccountById(accountId);
  
  if (!account) {
    throw new Error('Conta não encontrada');
  }
  
  if (!account.isDefault) {
    throw new Error('Esta operação só é permitida para contas padrão');
  }
  
  if (account.initialBalanceSet) {
    throw new Error('O saldo inicial já foi definido e não pode ser alterado novamente');
  }

  const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await updateDoc(docRef, {
    initialBalance,
    balance: initialBalance,
    initialBalanceSet: true,
    updatedAt: Timestamp.now(),
  });
}
// Recalcular saldo da conta com base nas transações reais
// Esta função deve ser chamada quando houver suspeita de inconsistência
export async function recalculateAccountBalance(
  userId: string,
  accountId: string
): Promise<number> {
  const account = await getAccountById(accountId);
  if (!account) {
    throw new Error('Conta não encontrada');
  }

  // Buscar todas as transações completed da conta
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  
  // Transações onde a conta é origem (accountId)
  const q1 = query(
    transactionsRef,
    where('userId', '==', userId),
    where('accountId', '==', accountId),
    where('status', '==', 'completed')
  );

  // Transações onde a conta é destino (toAccountId) - transferências recebidas
  const q2 = query(
    transactionsRef,
    where('userId', '==', userId),
    where('toAccountId', '==', accountId),
    where('status', '==', 'completed')
  );

  const [snapshot1, snapshot2] = await Promise.all([
    getDocs(q1),
    getDocs(q2)
  ]);

  let calculatedBalance = account.initialBalance || 0;

  // Processar transações onde a conta é origem
  snapshot1.forEach(doc => {
    const transaction = doc.data();
    // Pular transações de cartão de crédito (não afetam saldo da conta)
    if (transaction.creditCardId) return;
    
    if (transaction.type === 'expense') {
      // Despesa: subtrai
      calculatedBalance -= transaction.amount;
    } else if (transaction.type === 'income') {
      // Receita: adiciona
      calculatedBalance += transaction.amount;
    } else if (transaction.type === 'transfer') {
      // Transferência de saída: subtrai
      calculatedBalance -= transaction.amount;
    }
  });

  // Processar transações onde a conta é destino (transferências recebidas)
  snapshot2.forEach(doc => {
    const transaction = doc.data();
    if (transaction.type === 'transfer' && transaction.accountId !== accountId) {
      // Transferência de entrada: adiciona
      calculatedBalance += transaction.amount;
    }
  });

  // Atualizar o saldo da conta no banco
  const accountDocRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
  await updateDoc(accountDocRef, {
    balance: calculatedBalance,
    updatedAt: Timestamp.now(),
  });

  return calculatedBalance;
}