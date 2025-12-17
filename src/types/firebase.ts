// ==========================================
// TIPOS E INTERFACES DO FIREBASE
// ==========================================

import { Timestamp } from 'firebase/firestore';

// ==========================================
// BASE
// ==========================================

export interface BaseDocument {
  id: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ==========================================
// CATEGORIAS
// ==========================================

export type CategoryType = 'expense' | 'income';

export interface Category extends BaseDocument {
  name: string;
  icon: string;
  type: CategoryType;
  color?: string;
  isDefault?: boolean; // Categorias padrão do sistema
}

export type CreateCategoryInput = Omit<Category, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type UpdateCategoryInput = Partial<CreateCategoryInput>;

// ==========================================
// CONTAS
// ==========================================

export type AccountType = 'checking' | 'wallet' | 'investment' | 'other';

export interface Account extends BaseDocument {
  name: string;
  type: AccountType;
  balance: number;
  initialBalance: number;
  icon?: string;
  color?: string;
  includeInTotal: boolean; // Se inclui no saldo geral
  isArchived: boolean;
  isDefault?: boolean; // Conta padrão criada pelo sistema
  initialBalanceSet?: boolean; // Se o saldo inicial já foi definido pelo usuário
}

export type CreateAccountInput = Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'balance'> & {
  balance?: number;
};
export type UpdateAccountInput = Partial<CreateAccountInput> & {
  balance?: number;
};

// Labels para tipos de conta
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta Corrente',
  wallet: 'Carteira',
  investment: 'Investimento',
  other: 'Outro',
};

// ==========================================
// CARTÕES DE CRÉDITO
// ==========================================

export interface CreditCard extends BaseDocument {
  name: string;
  brand?: string; // Bandeira/Banco (nubank, itau, etc.)
  lastDigits?: string; // Últimos 4 dígitos
  limit: number;
  currentUsed?: number; // Valor atualmente utilizado do limite
  closingDay: number; // Dia de fechamento (1-31)
  dueDay: number; // Dia de vencimento (1-31)
  paymentAccountId?: string; // Conta de pagamento da fatura
  icon?: string;
  color?: string;
  isArchived: boolean;
}

export type CreateCreditCardInput = Omit<CreditCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type UpdateCreditCardInput = Partial<CreateCreditCardInput>;

// ==========================================
// TRANSAÇÕES / LANÇAMENTOS
// ==========================================

export type TransactionType = 'expense' | 'income' | 'transfer';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled';

export interface Transaction extends BaseDocument {
  type: TransactionType;
  amount: number;
  description: string;
  date: Timestamp;
  
  // Categoria (não aplicável para transferências)
  categoryId?: string;
  categoryName?: string; // Desnormalizado para performance
  categoryIcon?: string;
  
  // Conta origem (opcional - não presente quando usa apenas cartão de crédito)
  accountId?: string;
  accountName?: string; // Desnormalizado
  
  // Conta destino (apenas para transferências)
  toAccountId?: string;
  toAccountName?: string;
  
  // Cartão de crédito (opcional, para despesas no cartão)
  creditCardId?: string;
  creditCardName?: string;
  
  // Recorrência
  recurrence: RecurrenceType;
  recurrenceEndDate?: Timestamp;
  parentTransactionId?: string; // Se é uma transação gerada por recorrência
  seriesId?: string; // Identificador único da série de transações recorrentes
  
  // Status
  status: TransactionStatus;
  
  // Campos auxiliares
  notes?: string;
  tags?: string[];
  
  // Aporte em meta financeira
  goalId?: string;
  goalName?: string;
  
  // Pagamento de fatura de cartão
  creditCardBillId?: string; // Se esta transação é um pagamento de fatura
  
  // Para organização por período
  month: number; // 1-12
  year: number;
}

export type CreateTransactionInput = Omit<
  Transaction, 
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'month' | 'year' | 'categoryName' | 'categoryIcon' | 'accountName' | 'toAccountName' | 'creditCardName'
>;
export type UpdateTransactionInput = Partial<CreateTransactionInput>;

// ==========================================
// FATURA DO CARTÃO
// ==========================================

export interface CreditCardBill extends BaseDocument {
  creditCardId: string;
  creditCardName: string;
  month: number;
  year: number;
  totalAmount: number;
  dueDate: Timestamp;
  isPaid: boolean;
  paidAt?: Timestamp;
  paidFromAccountId?: string;
  paymentTransactionId?: string;
}

// ==========================================
// PREFERÊNCIAS DO USUÁRIO
// ==========================================

export interface UserPreferences {
  id: string;
  userId: string;
  theme: 'teal' | 'dark' | 'light';
  currency: string;
  language: string;
  homeComponentsOrder: string[];
  notifications: {
    billReminders: boolean;
    goalProgress: boolean;
    weeklyReport: boolean;
  };
}

// ==========================================
// METAS FINANCEIRAS
// ==========================================

export type GoalTimeframe = 'short' | 'medium' | 'long';

export interface Goal extends BaseDocument {
  name: string;
  targetAmount: number;
  currentAmount: number;
  timeframe: GoalTimeframe;
  isActive: boolean;
  completedAt?: Timestamp;
  icon?: string;
  color?: string;
}

export type CreateGoalInput = Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'currentAmount'> & {
  currentAmount?: number;
};
export type UpdateGoalInput = Partial<Omit<CreateGoalInput, 'isActive'>>;

// Labels para prazos
export const GOAL_TIMEFRAME_LABELS: Record<GoalTimeframe, string> = {
  short: 'Curto prazo',
  medium: 'Médio prazo',
  long: 'Longo prazo',
};

// Descrições dos prazos
export const GOAL_TIMEFRAME_DESCRIPTIONS: Record<GoalTimeframe, string> = {
  short: 'até 1 ano',
  medium: '1 a 5 anos',
  long: 'acima de 5 anos',
};

// Ícones sugeridos para metas
export const GOAL_ICONS = [
  'piggy-bank', 'home', 'car', 'airplane', 'briefcase', 
  'school', 'heart', 'trophy', 'star', 'wallet',
];

// ==========================================
// HELPERS / CONSTANTES
// ==========================================

// Categorias padrão de despesa
export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Alimentação', icon: 'food', type: 'expense' },
  { name: 'Transporte', icon: 'bus', type: 'expense' },
  { name: 'Moradia', icon: 'home', type: 'expense' },
  { name: 'Saúde', icon: 'hospital-box', type: 'expense' },
  { name: 'Educação', icon: 'school', type: 'expense' },
  { name: 'Compras', icon: 'shopping', type: 'expense' },
  { name: 'Lazer', icon: 'gamepad-variant', type: 'expense' },
  { name: 'Outros', icon: 'dots-horizontal', type: 'expense' },
];

// Categorias padrão de receita
export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Renda', icon: 'cash-multiple', type: 'income', isDefault: true },
];

// Ícones disponíveis para categorias
export const CATEGORY_ICONS = {
  expense: [
    'food', 'bus', 'home', 'hospital-box', 'school', 'shopping', 
    'gamepad-variant', 'dumbbell', 'paw', 'car', 'cellphone', 'wifi',
    'lightning-bolt', 'water', 'gas-station', 'pill', 'gift', 'dots-horizontal',
  ],
  income: [
    'briefcase', 'cash-multiple', 'chart-line', 'hand-coin', 
    'gift', 'sale', 'cash-refund', 'dots-horizontal',
  ],
};

// Ícones para contas
export const ACCOUNT_ICONS = [
  'wallet', 'bank', 'piggy-bank', 'cash', 'credit-card', 
  'safe', 'chart-line', 'bitcoin', 'currency-usd',
];

// Ícones para cartões de crédito
export const CREDIT_CARD_ICONS = [
  'credit-card', 'credit-card-outline', 'credit-card-chip', 
  'credit-card-wireless', 'card-bulleted',
];
