// ==========================================
// SERVIÇO DE CARTÕES DE CRÉDITO
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
    where,
    Timestamp,
    increment
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import {
    CreditCard,
    CreateCreditCardInput,
    UpdateCreditCardInput,
    CreditCardBill,
} from '../types/firebase';

const creditCardsRef = collection(db, COLLECTIONS.CREDIT_CARDS);
const billsRef = collection(db, COLLECTIONS.CREDIT_CARD_BILLS);

// ==========================================
// CARTÕES
// ==========================================

// Criar cartão de crédito
export async function createCreditCard(
  userId: string,
  data: CreateCreditCardInput
): Promise<CreditCard> {
  const now = Timestamp.now();

  const docRef = await addDoc(creditCardsRef, {
    ...data,
    userId,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    userId,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
}

// Buscar todos os cartões do usuário
export async function getCreditCards(userId: string): Promise<CreditCard[]> {
  const q = query(
    creditCardsRef,
    where('userId', '==', userId),
    where('isArchived', '==', false)
  );

  const snapshot = await getDocs(q);
  const cards = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CreditCard[];
  
  return cards.sort((a, b) => a.name.localeCompare(b.name));
}

// Buscar todos os cartões (incluindo arquivados)
export async function getAllCreditCards(userId: string): Promise<CreditCard[]> {
  const q = query(
    creditCardsRef,
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  const cards = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CreditCard[];
  
  return cards.sort((a, b) => a.name.localeCompare(b.name));
}

// Buscar cartão por ID
export async function getCreditCardById(cardId: string): Promise<CreditCard | null> {
  const docRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as CreditCard;
}

// Atualizar cartão
export async function updateCreditCard(
  cardId: string,
  data: UpdateCreditCardInput
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
  
  // Se o nome foi alterado, atualizar nas transações e faturas também
  if (data.name) {
    // Buscar o cartão para obter o userId
    const cardSnapshot = await getDoc(docRef);
    if (cardSnapshot.exists()) {
      const cardData = cardSnapshot.data();
      // Importar dinamicamente para evitar dependência circular
      const { updateCreditCardNameInTransactions } = await import('./transactionService');
      const { updateCreditCardNameInBills } = await import('./creditCardBillService');
      
      // Atualizar nome nas transações e faturas em paralelo
      await Promise.all([
        updateCreditCardNameInTransactions(cardData.userId, cardId, data.name),
        updateCreditCardNameInBills(cardData.userId, cardId, data.name),
      ]);
    }
  }
  
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Arquivar cartão
export async function archiveCreditCard(cardId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
  await updateDoc(docRef, {
    isArchived: true,
    updatedAt: Timestamp.now(),
  });
}

// Desarquivar cartão
export async function unarchiveCreditCard(cardId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
  await updateDoc(docRef, {
    isArchived: false,
    updatedAt: Timestamp.now(),
  });
}

// Deletar cartão (apenas o cartão e faturas - transações devem ser deletadas pelo hook com userId)
export async function deleteCreditCard(cardId: string, userId?: string): Promise<number> {
  // Se userId foi passado, deletar faturas associadas ao cartão
  if (userId) {
    const billsRef = collection(db, COLLECTIONS.CREDIT_CARD_BILLS);
    const billsQuery = query(
      billsRef,
      where('userId', '==', userId),
      where('creditCardId', '==', cardId)
    );
    
    const billsSnapshot = await getDocs(billsQuery);
    const deleteBillPromises = billsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deleteBillPromises);
    
    console.log(`🗑️ ${billsSnapshot.docs.length} faturas deletadas junto com o cartão`);
  }
  
  // Deletar o cartão
  const docRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
  await deleteDoc(docRef);
  
  return 0;
}

// Atualizar uso do cartão (adicionar ou remover valor)
export async function updateCreditCardUsage(
  cardId: string,
  amount: number // positivo para adicionar uso, negativo para remover (estorno)
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
  await updateDoc(docRef, {
    currentUsed: increment(amount),
    updatedAt: Timestamp.now(),
  });
}

// Recalcular valor usado do cartão com base nas transações reais
// Esta função deve ser chamada após deletar transações para garantir consistência
export async function recalculateCreditCardUsage(
  userId: string,
  cardId: string
): Promise<number> {
  // Buscar todas as transações do cartão
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('creditCardId', '==', cardId)
  );
  
  const snapshot = await getDocs(q);
  
  // Calcular valor usado real
  let realUsed = 0;
  snapshot.forEach(doc => {
    const transaction = doc.data();
    if (transaction.status === 'cancelled') return;
    
    // Despesa adiciona, receita (estorno) subtrai
    if (transaction.type === 'expense') {
      realUsed += transaction.amount;
    } else if (transaction.type === 'income') {
      realUsed -= transaction.amount;
    }
  });

  // Atualizar o cartão com o valor real
  const cardDocRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
  await updateDoc(cardDocRef, {
    currentUsed: realUsed,
    updatedAt: Timestamp.now(),
  });

  return realUsed;
}

// ==========================================
// FATURAS
// ==========================================

// Buscar fatura do cartão por mês/ano
export async function getCardBill(
  creditCardId: string,
  month: number,
  year: number
): Promise<CreditCardBill | null> {
  const q = query(
    billsRef,
    where('creditCardId', '==', creditCardId),
    where('month', '==', month),
    where('year', '==', year)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as CreditCardBill;
}

// Buscar todas as faturas de um mês
export async function getBillsByMonth(
  userId: string,
  month: number,
  year: number
): Promise<CreditCardBill[]> {
  const q = query(
    billsRef,
    where('userId', '==', userId),
    where('month', '==', month),
    where('year', '==', year)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as CreditCardBill[];
}

// Marcar fatura como paga
export async function markBillAsPaid(
  billId: string,
  accountId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.CREDIT_CARD_BILLS, billId);
  await updateDoc(docRef, {
    isPaid: true,
    paidAt: Timestamp.now(),
    paidFromAccountId: accountId,
    updatedAt: Timestamp.now(),
  });
}

// Calcular data de vencimento com base no mês/ano e dia de vencimento
export function calculateDueDate(dueDay: number, month: number, year: number): Date {
  // Se o dia de vencimento é maior que os dias do mês, usar o último dia
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const day = Math.min(dueDay, lastDayOfMonth);
  return new Date(year, month - 1, day);
}

// Determinar em qual fatura uma compra cairá baseado na data e dia de fechamento
export function getBillMonth(
  purchaseDate: Date,
  closingDay: number
): { month: number; year: number } {
  const day = purchaseDate.getDate();
  let month = purchaseDate.getMonth() + 1; // 1-12
  let year = purchaseDate.getFullYear();

  // Se a compra foi feita após o fechamento, vai para a fatura do próximo mês
  if (day > closingDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return { month, year };
}
