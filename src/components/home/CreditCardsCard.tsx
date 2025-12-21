import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useMemo } from 'react';
import { useAppTheme } from '../../contexts/themeContext';
import { getShadow } from '../../theme';
import { formatCurrencyBRL } from '../../utils/format';
import { CreditCard } from '../../types/firebase';

interface Props {
  cards?: CreditCard[];
  totalBills?: number;
  totalIncome?: number; // Receita do mês para calcular porcentagem
  onCardPress?: (card: CreditCard) => void;
  onAddPress?: () => void;
}

// Cores para os cartões baseado no nome (paleta harmônica com roxo)
const getCardColor = (name: string, customColor?: string): string => {
  // Lista de cores azuis que devem ser substituídas por roxo
  const blueColors = ['#3B82F6', '#3b82f6', '#06b6d4', '#0ea5e9', '#2563eb', '#1d4ed8'];
  
  // Se a cor customizada for azul, usar roxo principal
  if (customColor && blueColors.includes(customColor.toLowerCase())) {
    return '#5B3CC4'; // roxo principal
  }
  
  if (customColor) return customColor;
  const colors = ['#5B3CC4', '#7B5CD6', '#2FAF8E', '#E07A3F', '#ec4899', '#C4572D'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

// Cor roxa escura para títulos principais
const primaryDark = '#4A2FA8';
// Fundo mais claro para visual moderno
const lightBg = '#FAFAFA';

// Status de uso do cartão baseado na porcentagem de gastos vs receitas
type CardUsageStatus = {
  level: 'controlled' | 'warning' | 'alert';
  message: string;
  icon: 'check-circle' | 'alert-circle' | 'alert';
  color: string;
};

const getCardUsageStatus = (totalUsed: number, totalIncome: number, colors: any): CardUsageStatus => {
  if (totalIncome === 0) {
    return {
      level: 'controlled',
      message: 'Sem receitas registradas neste mês',
      icon: 'check-circle',
      color: colors.textMuted,
    };
  }

  const percentage = (totalUsed / totalIncome) * 100;

  if (percentage <= 30) {
    return {
      level: 'controlled',
      message: 'Gastos controlados',
      icon: 'check-circle',
      color: '#22C55E', // verde
    };
  } else if (percentage <= 50) {
    return {
      level: 'warning',
      message: 'Cuidado, você está se aproximando do limite recomendado',
      icon: 'alert-circle',
      color: '#F59E0B', // amarelo/laranja
    };
  } else {
    return {
      level: 'alert',
      message: 'Atenção, gastos elevados no cartão',
      icon: 'alert',
      color: '#EF4444', // vermelho
    };
  }
};

export default function CreditCardsCard({ cards = [], totalBills = 0, totalIncome = 0, onCardPress, onAddPress }: Props) {
  const { colors } = useAppTheme();
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Calcular total usado em todos os cartões
  const totalUsed = useMemo(() => {
    return cards.reduce((sum, card) => sum + (card.currentUsed || 0), 0);
  }, [cards]);

  // Status do uso dos cartões
  const usageStatus = useMemo(() => {
    return getCardUsageStatus(totalUsed, totalIncome, colors);
  }, [totalUsed, totalIncome, colors]);

  // Porcentagem de uso
  const usagePercentage = useMemo(() => {
    if (totalIncome === 0) return 0;
    return (totalUsed / totalIncome) * 100;
  }, [totalUsed, totalIncome]);

  // Componente de item do cartão (compacto e moderno)
  const CardItem = ({ card }: { card: CreditCard }) => {
    const cardColor = getCardColor(card.name, card.color);
    const used = card.currentUsed || 0;
    const available = card.limit - used;
    
    // Determinar status da fatura
    const today = new Date().getDate();
    const isPaid = used === 0;
    const isPending = !isPaid && today <= card.dueDay;
    const isOverdue = !isPaid && today > card.dueDay;
    
    const getStatusBadge = () => {
      if (isOverdue) return { text: 'Vencida', color: colors.expense };
      if (isPending) return { text: 'Pendente', color: colors.textMuted };
      return null;
    };
    
    const statusBadge = getStatusBadge();
    
    return (
      <Pressable
        onPress={() => onCardPress?.(card)}
        style={({ pressed }) => [
          styles.cardItem,
          { 
            backgroundColor: lightBg,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : 1,
          }
        ]}
      >
        <View style={styles.cardContent}>
          {/* Ícone + Nome do cartão + Status */}
          <View style={styles.topRow}>
            <View style={[styles.cardIconSmall, { backgroundColor: `${cardColor}15` }]}>
              <MaterialCommunityIcons
                name={(card.icon as any) || 'credit-card'}
                size={24}
                color={cardColor}
              />
            </View>
            <Text style={[styles.cardNameCompact, { color: colors.text }]} numberOfLines={1}>
              {card.name}
            </Text>
            {statusBadge && (
              <View style={[styles.statusBadgeCompact, { backgroundColor: `${statusBadge.color}15` }]}>
                <Text style={[styles.statusTextCompact, { color: statusBadge.color }]}>
                  {statusBadge.text}
                </Text>
              </View>
            )}
          </View>

          {/* Vencimento + Valor da fatura */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Vencimento</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                Dia {card.dueDay}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Valor da fatura</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {formatCurrencyBRL(used)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: '#fff' }, getShadow(colors)]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: primaryDark }]}>
              Meus cartões
            </Text>
            {cards.length > 0 && totalUsed > 0 && (
              <Pressable 
                onPress={() => setShowStatusModal(true)}
                style={({ pressed }) => [
                  styles.statusIconButton,
                  { opacity: pressed ? 0.7 : 1 }
                ]}
              >
                <MaterialCommunityIcons 
                  name={usageStatus.icon} 
                  size={22} 
                  color={usageStatus.color} 
                />
              </Pressable>
            )}
          </View>
          {cards.length > 0 && (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {cards.length} cartão{cards.length > 1 ? 'es' : ''} cadastrado{cards.length > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Lista de cartões */}
      <View style={styles.cardsList}>
        {cards.map((card) => (
          <CardItem key={card.id} card={card} />
        ))}
      </View>

      {/* Mensagem vazia */}
      {cards.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="credit-card-plus" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Nenhum cartão cadastrado
          </Text>
        </View>
      )}

      {/* Modal de Status de Uso dos Cartões */}
      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            {/* Ícone e status principal */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: `${usageStatus.color}15` }]}>
                <MaterialCommunityIcons 
                  name={usageStatus.icon} 
                  size={32} 
                  color={usageStatus.color} 
                />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {usageStatus.message}
              </Text>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

            {/* Resumo dos compromissos */}
            <View style={styles.modalDetails}>
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Total em faturas:</Text>
                <Text style={[styles.modalValue, { color: colors.expense }]}>
                  {formatCurrencyBRL(totalUsed)}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Receitas do mês:</Text>
                <Text style={[styles.modalValue, { color: colors.income }]}>
                  {formatCurrencyBRL(totalIncome)}
                </Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Comprometimento:</Text>
                <Text style={[styles.modalValue, { color: usageStatus.color }]}>
                  {usagePercentage.toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

            {/* Detalhes por cartão */}
            <View style={styles.modalCardsList}>
              <Text style={[styles.modalSectionTitle, { color: colors.text }]}>
                Por cartão
              </Text>
              {cards.filter(c => (c.currentUsed || 0) > 0).map((card) => (
                <View key={card.id} style={styles.modalCardItem}>
                  <View style={styles.modalCardInfo}>
                    <View style={[styles.modalCardIcon, { backgroundColor: `${getCardColor(card.name, card.color)}15` }]}>
                      <MaterialCommunityIcons 
                        name={(card.icon as any) || 'credit-card'} 
                        size={16} 
                        color={getCardColor(card.name, card.color)} 
                      />
                    </View>
                    <Text style={[styles.modalCardName, { color: colors.text }]} numberOfLines={1}>
                      {card.name}
                    </Text>
                  </View>
                  <Text style={[styles.modalCardValue, { color: colors.expense }]}>
                    {formatCurrencyBRL(card.currentUsed || 0)}
                  </Text>
                </View>
              ))}
              {cards.filter(c => (c.currentUsed || 0) > 0).length === 0 && (
                <Text style={[styles.modalEmptyText, { color: colors.textMuted }]}>
                  Nenhuma fatura em aberto
                </Text>
              )}
            </View>

            {/* Dica */}
            <View style={[styles.modalTip, { backgroundColor: `${usageStatus.color}10` }]}>
              <MaterialCommunityIcons 
                name="lightbulb-outline" 
                size={16} 
                color={usageStatus.color} 
              />
              <Text style={[styles.modalTipText, { color: colors.textMuted }]}>
                {usageStatus.level === 'controlled' 
                  ? 'Continue assim! Manter os gastos no cartão abaixo de 30% das receitas é ideal.'
                  : usageStatus.level === 'warning'
                  ? 'Considere revisar seus gastos. O ideal é manter abaixo de 30% das receitas.'
                  : 'Revise seus gastos no cartão para evitar comprometer seu orçamento.'}
              </Text>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    marginBottom: 16,
  },
  titleSection: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
  },
  cardsList: {
    gap: 12,
  },
  cardItem: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNameCompact: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  statusBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTextCompact: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  infoItem: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  // Estilos do ícone de status
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIconButton: {
    padding: 4,
  },
  // Estilos da modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalDivider: {
    height: 1,
    marginVertical: 16,
  },
  modalDetails: {
    gap: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalLabel: {
    fontSize: 14,
  },
  modalValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalCardsList: {
    gap: 10,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalCardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCardName: {
    fontSize: 14,
    flex: 1,
  },
  modalCardValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalEmptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  modalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  modalTipText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
});
