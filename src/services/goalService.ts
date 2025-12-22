// ==========================================
// SERVIÇO DE METAS FINANCEIRAS
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
    Timestamp, limit
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import {
    Goal,
    CreateGoalInput,
    UpdateGoalInput,
} from '../types/firebase';

const goalsRef = collection(db, COLLECTIONS.GOALS);

// Criar meta
export async function createGoal(
  userId: string,
  data: CreateGoalInput,
  setAsPrimary: boolean = false
): Promise<Goal> {
  // Se deve ser definida como principal, desmarcar outras como principais
  if (setAsPrimary) {
    await unsetAllPrimaryGoals(userId);
  }

  const now = Timestamp.now();
  const inputData = data as any;

  // Montar objeto apenas com campos definidos (Firestore não aceita undefined)
  const goalData: Record<string, any> = {
    name: data.name,
    targetAmount: data.targetAmount,
    currentAmount: inputData.currentAmount ?? 0,
    timeframe: data.timeframe,
    isActive: data.isActive,
    isPrimary: setAsPrimary,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  // Adicionar campos opcionais apenas se definidos
  if (data.icon) goalData.icon = data.icon;
  if (data.color) goalData.color = data.color;
  if (data.targetDate) goalData.targetDate = data.targetDate;

  const docRef = await addDoc(goalsRef, goalData);

  const createdGoal: Goal = {
    id: docRef.id,
    userId,
    name: data.name,
    targetAmount: data.targetAmount,
    currentAmount: inputData.currentAmount ?? 0,
    timeframe: data.timeframe,
    isActive: true,
    isPrimary: setAsPrimary,
    icon: data.icon,
    color: data.color,
    createdAt: now,
    updatedAt: now,
  };

  return createdGoal;
}

// Buscar meta ativa do usuário (DEPRECATED - usar getPrimaryGoal)
export async function getActiveGoal(userId: string): Promise<Goal | null> {
  const q = query(
    goalsRef,
    where('userId', '==', userId),
    where('isActive', '==', true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Goal;
}

// Buscar meta principal do usuário (para exibir na Home)
export async function getPrimaryGoal(userId: string): Promise<Goal | null> {
  const q = query(
    goalsRef,
    where('userId', '==', userId),
    where('isActive', '==', true),
    where('isPrimary', '==', true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Goal;
}

// Buscar todas as metas ativas do usuário
export async function getActiveGoals(userId: string): Promise<Goal[]> {
  const q = query(
    goalsRef,
    where('userId', '==', userId),
    where('isActive', '==', true)
  );

  const snapshot = await getDocs(q);
  const goals = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Goal[];
  
  // Ordenar no cliente para evitar necessidade de índice composto
  return goals.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

// Buscar todas as metas do usuário (histórico)
export async function getAllGoals(userId: string): Promise<Goal[]> {
  const q = query(
    goalsRef,
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  const goals = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Goal[];
  
  // Ordenar no cliente para evitar necessidade de índice composto
  return goals.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

// Buscar metas concluídas do usuário
export async function getCompletedGoals(userId: string): Promise<Goal[]> {
  const allGoals = await getAllGoals(userId);
  // Filtrar apenas metas que têm completedAt definido
  return allGoals.filter(goal => goal.completedAt);
}

// Buscar meta por ID
export async function getGoalById(goalId: string): Promise<Goal | null> {
  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Goal;
}

// Atualizar meta
export async function updateGoal(
  goalId: string,
  data: UpdateGoalInput
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Atualizar progresso da meta (adicionar valor)
export async function addToGoalProgress(
  goalId: string,
  amount: number
): Promise<void> {
  const goal = await getGoalById(goalId);
  if (!goal) throw new Error('Meta não encontrada');

  const newAmount = goal.currentAmount + amount;
  const isCompleted = newAmount >= goal.targetAmount;

  const updateData: any = {
    currentAmount: newAmount,
    updatedAt: Timestamp.now(),
  };

  if (isCompleted && !goal.completedAt) {
    updateData.completedAt = Timestamp.now();
  }

  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  await updateDoc(docRef, updateData);
}

// Remover valor do progresso da meta (quando excluir transação de aporte)
export async function removeFromGoalProgress(
  goalId: string,
  amount: number
): Promise<void> {
  const goal = await getGoalById(goalId);
  if (!goal) return; // Se a meta não existe mais, não faz nada

  const newAmount = Math.max(0, goal.currentAmount - amount);

  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  await updateDoc(docRef, {
    currentAmount: newAmount,
    updatedAt: Timestamp.now(),
  });
}

// Definir progresso da meta (valor absoluto)
export async function setGoalProgress(
  goalId: string,
  amount: number
): Promise<void> {
  const goal = await getGoalById(goalId);
  if (!goal) throw new Error('Meta não encontrada');

  const isCompleted = amount >= goal.targetAmount;

  const updateData: any = {
    currentAmount: amount,
    updatedAt: Timestamp.now(),
  };

  if (isCompleted && !goal.completedAt) {
    updateData.completedAt = Timestamp.now();
  }

  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  await updateDoc(docRef, updateData);
}

// Desativar meta atual (quando criar nova)
async function deactivateCurrentGoal(userId: string): Promise<void> {
  const currentGoal = await getActiveGoal(userId);
  if (currentGoal) {
    const docRef = doc(db, COLLECTIONS.GOALS, currentGoal.id);
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: Timestamp.now(),
    });
  }
}

// Desmarcar todas as metas como principais
async function unsetAllPrimaryGoals(userId: string): Promise<void> {
  const activeGoals = await getActiveGoals(userId);
  const primaryGoals = activeGoals.filter(g => g.isPrimary);
  
  for (const goal of primaryGoals) {
    const docRef = doc(db, COLLECTIONS.GOALS, goal.id);
    await updateDoc(docRef, {
      isPrimary: false,
      updatedAt: Timestamp.now(),
    });
  }
}

// Garantir que sempre haja uma meta principal se houver apenas uma meta ativa
async function ensurePrimaryGoalExists(userId: string): Promise<void> {
  const activeGoals = await getActiveGoals(userId);
  
  // Se houver apenas uma meta ativa, ela deve ser principal
  if (activeGoals.length === 1 && !activeGoals[0].isPrimary) {
    const docRef = doc(db, COLLECTIONS.GOALS, activeGoals[0].id);
    await updateDoc(docRef, {
      isPrimary: true,
      updatedAt: Timestamp.now(),
    });
  }
}

// Definir uma meta como principal
export async function setPrimaryGoal(goalId: string, userId: string): Promise<void> {
  // Desmarcar todas as outras como principais
  await unsetAllPrimaryGoals(userId);
  
  // Marcar esta como principal
  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  await updateDoc(docRef, {
    isPrimary: true,
    updatedAt: Timestamp.now(),
  });
}

// Verificar se pode desmarcar como principal (não permitir se for a única meta)
export async function canUnsetPrimary(userId: string): Promise<boolean> {
  const activeGoals = await getActiveGoals(userId);
  return activeGoals.length > 1;
}

// Desativar meta manualmente
export async function deactivateGoal(goalId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  await updateDoc(docRef, {
    isActive: false,
    updatedAt: Timestamp.now(),
  });
}

// Deletar meta
export async function deleteGoal(goalId: string, userId: string): Promise<void> {
  // Buscar a meta para verificar se existe
  const goal = await getGoalById(goalId);
  if (!goal) throw new Error('Meta não encontrada');

  // Importar funções de transação
  const { deleteTransactionsByGoal } = await import('./transactionService');

  // SEMPRE excluir as transações associadas à meta
  // Isso reverte o saldo das contas para o estado anterior aos aportes
  await deleteTransactionsByGoal(userId, goalId);

  // Deletar a meta
  const docRef = doc(db, COLLECTIONS.GOALS, goalId);
  await deleteDoc(docRef);
  
  // Se sobrar apenas 1 meta ativa, torná-la principal automaticamente
  await ensurePrimaryGoalExists(userId);
}

// Calcular percentual de progresso
export function calculateGoalProgress(currentAmount: number, targetAmount: number): number {
  if (targetAmount === 0) return 0;
  return Math.min((currentAmount / targetAmount) * 100, 100);
}

// Calcular tempo restante até a data alvo
export function calculateTimeRemaining(targetDate: Timestamp | undefined): {
  months: number;
  days: number;
  isOverdue: boolean;
  formattedText: string;
} | null {
  if (!targetDate) return null;

  const now = new Date();
  const target = targetDate.toDate();
  
  // Calcular diferença em milissegundos
  const diffMs = target.getTime() - now.getTime();
  const isOverdue = diffMs < 0;
  
  // Calcular dias totais
  const totalDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  
  // Calcular meses e dias restantes
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  
  // Formatar texto
  let formattedText = '';
  if (isOverdue) {
    formattedText = 'Meta vencida';
  } else if (months > 0 && days > 0) {
    formattedText = `${months} ${months === 1 ? 'mês' : 'meses'} e ${days} ${days === 1 ? 'dia' : 'dias'}`;
  } else if (months > 0) {
    formattedText = `${months} ${months === 1 ? 'mês' : 'meses'}`;
  } else if (days > 0) {
    formattedText = `${days} ${days === 1 ? 'dia' : 'dias'}`;
  } else {
    formattedText = 'Hoje';
  }
  
  return {
    months,
    days,
    isOverdue,
    formattedText,
  };
}

// Calcular aporte mensal necessário
export function calculateMonthlyContribution(
  currentAmount: number,
  targetAmount: number,
  targetDate: Timestamp | undefined
): {
  monthlyAmount: number;
  formattedText: string;
} | null {
  if (!targetDate) return null;
  
  const timeRemaining = calculateTimeRemaining(targetDate);
  if (!timeRemaining || timeRemaining.isOverdue) return null;
  
  const remainingAmount = targetAmount - currentAmount;
  if (remainingAmount <= 0) return { monthlyAmount: 0, formattedText: 'Meta concluída' };
  
  // Calcular total de meses (considerando dias como fração)
  const totalMonths = timeRemaining.months + (timeRemaining.days / 30);
  
  if (totalMonths <= 0) {
    return {
      monthlyAmount: remainingAmount,
      formattedText: 'Aporte total necessário',
    };
  }
  
  const monthlyAmount = remainingAmount / totalMonths;
  
  return {
    monthlyAmount,
    formattedText: 'por mês',
  };
}
