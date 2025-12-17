// ==========================================
// SERVIÇO DE FATURAS DE CARTÃO DE CRÉDITO
// ==========================================

import { collection, doc, addDoc, updateDoc, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import { CreditCardBill, Transaction, CreditCard } from '../types/firebase';
import { updateAccountBalance, getAccountById } from './accountService';
import { getCreditCardById, updateCreditCard } from './creditCardService';

const billsRef = collection(db, COLLECTIONS.CREDIT_CARD_BILLS);
const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

// ==========================================
// INTERFACE DE FATURA COM TRANSAÇÕES
// ==========================================

export interface CreditCardBillWithTransactions extends CreditCardBill {
  transactions: Transaction[];
  creditCard?: CreditCard;
}

// ==========================================
// BUSCAR TRANSAÇÕES DO CARTÃO POR MÊS
// ==========================================

export async function getCreditCardTransactionsByMonth(
  userId: string,
  creditCardId: string,
  month: number,
  year: number
): Promise<Transaction[]> {
  const q = query(
    transactionsRef,
    where('userId', '==', userId),
    where('creditCardId', '==', creditCardId),
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

// ==========================================
// CALCULAR TOTAL DA FATURA
// ==========================================

export function calculateBillTotal(transactions: Transaction[]): number {
  return transactions.reduce((total, t) => {
    if (t.status === 'cancelled') return total;
    // Despesa adiciona ao total, receita (estorno) subtrai
    return total + (t.type === 'expense' ? t.amount : -t.amount);
  }, 0);
}

// ==========================================
// BUSCAR OU CRIAR FATURA DO MÊS
// ==========================================

export async function getOrCreateBill(
  userId: string,
  creditCardId: string,
  creditCardName: string,
  month: number,
  year: number,
  dueDay: number
): Promise<CreditCardBill> {
  // Buscar fatura existente
  const q = query(
    billsRef,
    where('userId', '==', userId),
    where('creditCardId', '==', creditCardId),
    where('month', '==', month),
    where('year', '==', year)
  );

  const snapshot = await getDocs(q);
  
  if (snapshot.docs.length > 0) {
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as CreditCardBill;
  }

  // Criar nova fatura
  const now = Timestamp.now();
  const dueDate = new Date(year, month - 1, dueDay);
  
  const billData = {
    userId,
    creditCardId,
    creditCardName,
    month,
    year,
    totalAmount: 0, // Será calculado dinamicamente
    dueDate: Timestamp.fromDate(dueDate),
    isPaid: false,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(billsRef, billData);

  return {
    id: docRef.id,
    ...billData,
  } as CreditCardBill;
}

// ==========================================
// BUSCAR FATURAS DO USUÁRIO POR MÊS
// ==========================================

export async function getBillsByMonth(
  userId: string,
  month: number,
  year: number
): Promise<CreditCardBillWithTransactions[]> {
  const q = query(
    billsRef,
    where('userId', '==', userId),
    where('month', '==', month),
    where('year', '==', year)
  );

  const snapshot = await getDocs(q);
  const bills: CreditCardBillWithTransactions[] = [];

  for (const doc of snapshot.docs) {
    const billData = {
      id: doc.id,
      ...doc.data(),
    } as CreditCardBill;

    // Buscar transações do cartão
    const transactions = await getCreditCardTransactionsByMonth(
      userId,
      billData.creditCardId,
      month,
      year
    );

    // Buscar dados do cartão
    const creditCard = await getCreditCardById(billData.creditCardId);

    // Calcular total atualizado
    const totalAmount = calculateBillTotal(transactions);

    bills.push({
      ...billData,
      totalAmount,
      transactions,
      creditCard: creditCard || undefined,
    });
  }

  return bills;
}

// ==========================================
// GERAR FATURAS PARA TODOS OS CARTÕES COM TRANSAÇÕES
// ==========================================

export async function generateBillsForMonth(
  userId: string,
  month: number,
  year: number,
  creditCards: CreditCard[]
): Promise<CreditCardBillWithTransactions[]> {
  const bills: CreditCardBillWithTransactions[] = [];

  for (const card of creditCards) {
    // Buscar transações do cartão no mês
    const transactions = await getCreditCardTransactionsByMonth(
      userId,
      card.id,
      month,
      year
    );

    // Só criar fatura se houver transações
    if (transactions.length > 0) {
      const totalAmount = calculateBillTotal(transactions);

      // Buscar ou criar fatura
      const bill = await getOrCreateBill(
        userId,
        card.id,
        card.name,
        month,
        year,
        card.dueDay
      );

      bills.push({
        ...bill,
        totalAmount,
        transactions,
        creditCard: card,
      });
    }
  }

  return bills;
}

// ==========================================
// BUSCAR DETALHES DA FATURA
// ==========================================

export async function getBillDetails(
  userId: string,
  creditCardId: string,
  month: number,
  year: number
): Promise<CreditCardBillWithTransactions | null> {
  // Buscar cartão
  const creditCard = await getCreditCardById(creditCardId);
  if (!creditCard) return null;

  // Buscar transações
  const transactions = await getCreditCardTransactionsByMonth(
    userId,
    creditCardId,
    month,
    year
  );

  // Buscar ou criar fatura
  const bill = await getOrCreateBill(
    userId,
    creditCardId,
    creditCard.name,
    month,
    year,
    creditCard.dueDay
  );

  const totalAmount = calculateBillTotal(transactions);

  return {
    ...bill,
    totalAmount,
    transactions,
    creditCard,
  };
}

// ==========================================
// PAGAR FATURA
// ==========================================

export async function payBill(
  billId: string,
  creditCardId: string,
  accountId: string,
  amount: number
): Promise<void> {
  const now = Timestamp.now();
  const currentDate = now.toDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  // Buscar dados da conta e do cartão
  const account = await getAccountById(accountId);
  const creditCard = await getCreditCardById(creditCardId);

  if (!account || !creditCard) {
    throw new Error('Conta ou cartão não encontrado');
  }

  // Buscar dados da fatura para pegar o mês/ano da fatura
  const billDocRef = doc(billsRef, billId);
  const billSnapshot = await getDoc(billDocRef);
  const billData = billSnapshot.data() as CreditCardBill;

  // Criar transação de pagamento da fatura
  const paymentTransaction = {
    userId: account.userId,
    type: 'expense' as const,
    amount,
    description: `Pagamento fatura ${creditCard.name} - ${getMonthName(billData.month)}/${billData.year}`,
    date: now,
    month,
    year,
    accountId,
    accountName: account.name,
    categoryId: 'credit-card-payment',
    categoryName: 'Pagamento de Cartão',
    categoryIcon: 'credit-card',
    creditCardBillId: billId, // Marcar que esta transação é um pagamento de fatura
    recurrence: 'none' as const,
    status: 'completed' as const,
    createdAt: now,
    updatedAt: now,
  };

  // Adicionar transação
  const transactionDocRef = await addDoc(transactionsRef, paymentTransaction);

  // Atualizar fatura como paga e guardar o ID da transação
  await updateDoc(billDocRef, {
    isPaid: true,
    paidAt: now,
    paidFromAccountId: accountId,
    paymentTransactionId: transactionDocRef.id,
    totalAmount: amount,
    updatedAt: now,
  });

  // Debitar da conta de pagamento
  await updateAccountBalance(accountId, -amount);

  // Zerar o uso do cartão de crédito
  await updateCreditCard(creditCardId, {
    currentUsed: 0,
  });
}

// ==========================================
// DESFAZER PAGAMENTO DE FATURA
// ==========================================

export async function unpayBill(
  billId: string
): Promise<void> {
  const now = Timestamp.now();

  const billDocRef = doc(billsRef, billId);
  const snapshot = await getDoc(billDocRef);
  if (!snapshot.exists()) {
    throw new Error('Fatura não encontrada');
  }

  const billData = snapshot.data() as any;
  const paidFromAccountId: string | undefined = billData.paidFromAccountId;
  const paymentTransactionId: string | undefined = billData.paymentTransactionId;
  const creditCardId: string = billData.creditCardId;
  const month: number = billData.month;
  const year: number = billData.year;
  const userId: string = billData.userId;
  const amount: number = billData.totalAmount || 0;

  if (!paidFromAccountId) {
    throw new Error('Fatura não está marcada como paga ou não possui conta de pagamento');
  }

  // Deletar a transação de pagamento, se existir
  if (paymentTransactionId) {
    const transactionDocRef = doc(transactionsRef, paymentTransactionId);
    const transactionSnapshot = await getDoc(transactionDocRef);
    if (transactionSnapshot.exists()) {
      const transactionData = transactionSnapshot.data() as Transaction;
      // Importar e usar a função de deletar transação
      const { deleteTransaction } = await import('./transactionService');
      await deleteTransaction({ id: paymentTransactionId, ...transactionData } as Transaction);
    }
  }

  // Atualizar fatura como não paga
  await updateDoc(billDocRef, {
    isPaid: false,
    paidAt: null,
    paidFromAccountId: null,
    paymentTransactionId: null,
    updatedAt: now,
  });

  // Reverter débito na conta (adicionar o valor de volta)
  await updateAccountBalance(paidFromAccountId, amount);

  // Recalcular uso do cartão com base nas transações da fatura e restaurar
  const transactions = await getCreditCardTransactionsByMonth(userId, creditCardId, month, year);
  const currentUsed = calculateBillTotal(transactions);
  await updateCreditCard(creditCardId, { currentUsed });
}

// ==========================================
// VERIFICAR SE FATURA ESTÁ PAGA
// ==========================================

export async function isBillPaid(
  userId: string,
  creditCardId: string,
  month: number,
  year: number
): Promise<boolean> {
  const q = query(
    billsRef,
    where('userId', '==', userId),
    where('creditCardId', '==', creditCardId),
    where('month', '==', month),
    where('year', '==', year),
    where('isPaid', '==', true)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.length > 0;
}

// ==========================================
// OBTER NOME DO MÊS
// ==========================================

export function getMonthName(month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month - 1] || '';
}
