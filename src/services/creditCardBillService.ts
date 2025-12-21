// ==========================================
// SERVIÇO DE FATURAS DE CARTÃO DE CRÉDITO
// ==========================================

import { collection, doc, addDoc, updateDoc, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import { CreditCardBill, Transaction, CreditCard } from '../types/firebase';
import { updateAccountBalance, getAccountById } from './accountService';
import { getCreditCardById, updateCreditCard, getBillMonth } from './creditCardService';

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
    // Não incluir categoria - pagamento de fatura não é uma categoria de despesa
    // As despesas reais já foram registradas nas compras do cartão
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
  // IMPORTANTE: Isso deve ser feito ANTES de atualizar a fatura
  // Se falhar por permissão, o erro vai propagar e não vamos atualizar a fatura
  if (paymentTransactionId) {
    const transactionDocRef = doc(transactionsRef, paymentTransactionId);
    const transactionSnapshot = await getDoc(transactionDocRef);
    if (transactionSnapshot.exists()) {
      const transactionData = transactionSnapshot.data() as Transaction;
      // Importar e usar a função de deletar transação
      const { deleteTransaction } = await import('./transactionService');
      // Isso vai deletar a transação e reverter o saldo automaticamente
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

  // NOTA: Não chamamos updateAccountBalance aqui pois deleteTransaction já reverte
  // o saldo automaticamente para transações completed sem creditCardId

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
// BUSCAR FATURAS PENDENTES DO USUÁRIO
// ==========================================

// Retorna um Map com chave "creditCardId-month-year" para rápida verificação
export async function getPendingBillsMap(
  userId: string
): Promise<Map<string, boolean>> {
  const q = query(
    billsRef,
    where('userId', '==', userId),
    where('isPaid', '==', false)
  );

  const snapshot = await getDocs(q);
  const pendingMap = new Map<string, boolean>();

  snapshot.docs.forEach(doc => {
    const bill = doc.data() as CreditCardBill;
    const key = `${bill.creditCardId}-${bill.month}-${bill.year}`;
    pendingMap.set(key, true);
  });

  return pendingMap;
}

// ==========================================
// ATUALIZAR NOME DO CARTÃO NAS FATURAS
// ==========================================

/**
 * Atualiza o nome do cartão de crédito em todas as faturas associadas
 * Usado quando o usuário renomeia um cartão
 */
export async function updateCreditCardNameInBills(
  userId: string,
  creditCardId: string,
  newName: string
): Promise<number> {
  const q = query(
    billsRef,
    where('userId', '==', userId),
    where('creditCardId', '==', creditCardId)
  );

  const snapshot = await getDocs(q);
  let updatedCount = 0;

  for (const docSnapshot of snapshot.docs) {
    try {
      await updateDoc(doc(db, COLLECTIONS.CREDIT_CARD_BILLS, docSnapshot.id), {
        creditCardName: newName,
        updatedAt: Timestamp.now(),
      });
      updatedCount++;
    } catch (error) {
      console.error(`Erro ao atualizar fatura ${docSnapshot.id}:`, error);
    }
  }

  return updatedCount;
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

// ==========================================
// VALIDAÇÃO DE FATURA PARA NOVA TRANSAÇÃO
// ==========================================

export interface BillValidationResult {
  canAdd: boolean;
  billMonth: number;
  billYear: number;
  isPaid: boolean;
  isClosed: boolean;
  message?: string;
  suggestedMonth?: number;
  suggestedYear?: number;
}

/**
 * Valida se uma transação pode ser adicionada a uma fatura de cartão de crédito
 * Retorna informações sobre a fatura e se está paga ou fechada
 */
export async function validateBillForTransaction(
  userId: string,
  creditCardId: string,
  transactionDate: Date,
  closingDay: number
): Promise<BillValidationResult> {
  // Calcular qual fatura a transação cairia baseado na data e fechamento
  const billDate = getBillMonth(transactionDate, closingDay);
  const { month: billMonth, year: billYear } = billDate;
  
  // Verificar se a fatura está paga
  const paid = await isBillPaid(userId, creditCardId, billMonth, billYear);
  
  // Verificar se a fatura já fechou (comparar com data atual)
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  // Uma fatura está fechada se:
  // 1. O mês/ano da fatura é anterior ao mês/ano atual, OU
  // 2. É o mesmo mês/ano, mas o dia atual é maior que o dia de fechamento
  let isClosed = false;
  if (billYear < currentYear) {
    isClosed = true;
  } else if (billYear === currentYear && billMonth < currentMonth) {
    isClosed = true;
  } else if (billYear === currentYear && billMonth === currentMonth && currentDay > closingDay) {
    isClosed = true;
  }
  
  // Calcular próxima fatura disponível
  let suggestedMonth = billMonth;
  let suggestedYear = billYear;
  
  if (paid || isClosed) {
    // Avançar para próxima fatura
    suggestedMonth = billMonth + 1;
    if (suggestedMonth > 12) {
      suggestedMonth = 1;
      suggestedYear = billYear + 1;
    }
  }
  
  // Determinar mensagem apropriada
  let message: string | undefined;
  if (paid) {
    message = `A fatura de ${getMonthName(billMonth)}/${billYear} já foi paga. O lançamento será adicionado na fatura de ${getMonthName(suggestedMonth)}/${suggestedYear}.`;
  } else if (isClosed) {
    message = `A fatura de ${getMonthName(billMonth)}/${billYear} já fechou. O lançamento será adicionado na fatura de ${getMonthName(suggestedMonth)}/${suggestedYear}.`;
  }
  
  return {
    canAdd: !paid, // Pode adicionar se não estiver paga (fechada ainda permite)
    billMonth: paid ? suggestedMonth : billMonth,
    billYear: paid ? suggestedYear : billYear,
    isPaid: paid,
    isClosed,
    message,
    suggestedMonth: paid || isClosed ? suggestedMonth : undefined,
    suggestedYear: paid || isClosed ? suggestedYear : undefined,
  };
}

/**
 * Calcula a fatura correta para uma transação, 
 * considerando fechamento e redirecionando automaticamente para próxima fatura se necessário
 */
export async function getCorrectBillForTransaction(
  userId: string,
  creditCardId: string,
  transactionDate: Date,
  closingDay: number
): Promise<{ month: number; year: number; wasRedirected: boolean; message?: string }> {
  const validation = await validateBillForTransaction(userId, creditCardId, transactionDate, closingDay);
  
  return {
    month: validation.billMonth,
    year: validation.billYear,
    wasRedirected: validation.isPaid || validation.isClosed,
    message: validation.message,
  };
}
