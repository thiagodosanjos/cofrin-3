import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useAuth } from '../contexts/authContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/themeContext';
import AppHeader from '../components/AppHeader';
import MainLayout from '../components/MainLayout';
import ExpensesByCategoryCard from '../components/ExpensesByCategoryCard';
import { spacing, borderRadius, getShadow } from '../theme';
import { formatCurrencyBRL } from '../utils/format';
import { useMonthReport, useExpensesByCategory } from '../hooks/useFirebaseTransactions';
import { getAllCreditCards } from '../services/creditCardService';
import { getBillDetails } from '../services/creditCardBillService';

// Componente de stat card
interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
  colors: any;
}

function StatCard({ title, value, icon, iconBg, iconColor, subtitle, colors }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card }, getShadow(colors)]}>
      <View style={[styles.statIconContainer, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statTitle, { color: colors.textMuted }]}>{title}</Text>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        {subtitle && (
          <Text style={[styles.statSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
}

// Componente de barra de progresso simples para gráfico
interface ProgressBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  colors: any;
}

function ProgressBar({ label, value, maxValue, color, colors }: ProgressBarProps) {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  
  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.progressValue, { color: colors.text }]}>
          {formatCurrencyBRL(value)}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.progressFill, 
            { backgroundColor: color, width: `${percentage}%` }
          ]} 
        />
      </View>
    </View>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 700;

  // Mês atual
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Dados do relatório
  const { report, loading } = useMonthReport(currentMonth, currentYear);
  const { expenses: categoryExpenses } = useExpensesByCategory(currentMonth, currentYear);

  // Estado para faturas futuras
  const [futureCommitments, setFutureCommitments] = useState<Array<{
    month: number;
    year: number;
    monthName: string;
    totalAmount: number;
    percentage: number;
  }>>([]);
  const [loadingFuture, setLoadingFuture] = useState(false);

  // Nomes dos meses
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Buscar faturas futuras (próximos 6 meses)
  useEffect(() => {
    const loadFutureCommitments = async () => {
      if (!user || !report?.currentSalary) return;
      
      setLoadingFuture(true);
      try {
        const cards = await getAllCreditCards(user.uid);
        const activeCards = cards.filter(c => !c.isArchived);
        
        if (activeCards.length === 0) {
          setFutureCommitments([]);
          return;
        }

        const months = [];
        const currentSalary = report.currentSalary;
        
        // Próximos 6 meses (começando do próximo mês)
        for (let i = 1; i <= 6; i++) {
          let month = currentMonth + i;
          let year = currentYear;
          
          while (month > 12) {
            month -= 12;
            year += 1;
          }
          
          // Buscar total de faturas deste mês
          let totalAmount = 0;
          for (const card of activeCards) {
            const billData = await getBillDetails(user.uid, card.id, month, year);
            if (billData) {
              totalAmount += billData.totalAmount;
            }
          }
          
          // Só adiciona se houver fatura
          if (totalAmount > 0) {
            const percentage = (totalAmount / currentSalary) * 100;
            months.push({
              month,
              year,
              monthName: monthNames[month - 1],
              totalAmount,
              percentage
            });
          }
        }
        
        setFutureCommitments(months);
      } catch (error) {
        console.error('Erro ao carregar faturas futuras:', error);
        setFutureCommitments([]);
      } finally {
        setLoadingFuture(false);
      }
    };

    loadFutureCommitments();
  }, [user, report?.currentSalary, currentMonth, currentYear]);

  // Mês anterior
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Calcular evolução
  const savingsEvolution = useMemo(() => {
    if (!report) return { current: 0, previous: 0, difference: 0, improved: false };
    
    const current = report.balance;
    const previous = report.previousMonth.balance;
    const difference = current - previous;
    
    return {
      current,
      previous,
      difference,
      improved: difference > 0
    };
  }, [report]);

  // Máximo para o gráfico de barras
  const maxBalance = Math.max(
    Math.abs(savingsEvolution.current), 
    Math.abs(savingsEvolution.previous),
    1
  );

  if (loading) {
    return (
      <MainLayout>
        <ScrollView style={[styles.root, { backgroundColor: colors.bg }]}>
          <AppHeader />
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Carregando relatório...
            </Text>
          </View>
        </ScrollView>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ScrollView style={[styles.root, { backgroundColor: colors.bg }]} contentContainerStyle={styles.scrollContent}>
        <AppHeader />
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>Relatórios</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {monthNames[currentMonth - 1]} de {currentYear}
            </Text>

            {/* Alerta de dívida */}
            {report && report.debtPercentage >= 30 && (
              <View style={[styles.alertCard, { backgroundColor: colors.dangerBg }]}>
                <MaterialCommunityIcons name="alert" size={24} color={colors.expense} />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.expense }]}>
                    Atenção com suas dívidas!
                  </Text>
                  <Text style={[styles.alertText, { color: colors.text }]}>
                    Você já atingiu {report.debtPercentage.toFixed(0)}% de dívidas em cartão de crédito sobre o seu salário atual. 
                    O recomendado é manter abaixo de 30%.
                  </Text>
                </View>
              </View>
            )}

            {/* Cards de estatísticas */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Resumo financeiro
            </Text>
            
            <View style={[styles.statsGrid, isNarrow && styles.statsGridMobile]}>
              <StatCard
                title="Receitas"
                value={formatCurrencyBRL(report?.income || 0)}
                icon="arrow-up-circle"
                iconBg={colors.successBg}
                iconColor={colors.income}
                colors={colors}
              />
              <StatCard
                title="Despesas"
                value={formatCurrencyBRL(report?.expense || 0)}
                icon="arrow-down-circle"
                iconBg={colors.dangerBg}
                iconColor={colors.expense}
                colors={colors}
              />
              <StatCard
                title="Gastos débito"
                value={formatCurrencyBRL(report?.debitExpenses || 0)}
                icon="wallet"
                iconBg={colors.primaryBg}
                iconColor={colors.primary}
                colors={colors}
              />
              <StatCard
                title="Gastos crédito"
                value={formatCurrencyBRL(report?.creditExpenses || 0)}
                icon="credit-card"
                iconBg={colors.warningBg || '#FEF3C7'}
                iconColor={colors.warning || '#F59E0B'}
                colors={colors}
              />
            </View>

            {/* Compromisso futuro */}
            <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: colors.warningBg || '#FEF3C7' }]}>
                  <MaterialCommunityIcons name="calendar-clock" size={24} color={colors.warning || '#F59E0B'} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Compromissos de cartão</Text>
                <View style={styles.infoIcon}>
                  <MaterialCommunityIcons name="information" size={16} color={colors.textMuted} />
                </View>
              </View>
              
              <Text style={[styles.infoTooltip, { color: colors.textMuted }]}>
                O cálculo considera o total de suas receitas do mês e os valores lançados no cartão de crédito.
              </Text>

              {report?.currentSalary ? (
                <>
                  {/* Resumo principal - Percentual em destaque */}
                  <View style={styles.commitmentMain}>
                    <Text style={[
                      styles.commitmentPercentage,
                      { 
                        color: report.debtPercentage <= 30 
                          ? colors.income 
                          : report.debtPercentage <= 40 
                          ? colors.warning 
                          : colors.expense 
                      }
                    ]}>
                      {report.debtPercentage <= 30 ? '🟢' : report.debtPercentage <= 40 ? '🟡' : '🔴'} {report.debtPercentage % 1 === 0 ? report.debtPercentage.toFixed(0) : report.debtPercentage.toFixed(1)}% das receitas
                    </Text>
                    <Text style={[styles.commitmentAmount, { color: colors.textMuted }]}>
                      {formatCurrencyBRL(report?.totalCreditCardUsage || 0)} / mês
                    </Text>
                  </View>

                  {/* Renda considerada */}
                  <Text style={[styles.incomeReference, { color: colors.textMuted }]}>
                    Total de receitas: {formatCurrencyBRL(report.currentSalary)}
                  </Text>

                  {/* Feedback contextual */}
                  {report.debtPercentage > 40 && (
                    <View style={[styles.contextualFeedback, { backgroundColor: colors.dangerBg }]}>
                      <Text style={[styles.feedbackText, { color: colors.expense }]}>
                        Risco financeiro: comprometimento elevado do cartão.
                      </Text>
                    </View>
                  )}
                  {report.debtPercentage > 30 && report.debtPercentage <= 40 && (
                    <View style={[styles.contextualFeedback, { backgroundColor: colors.warningBg || '#FEF3C7' }]}>
                      <Text style={[styles.feedbackText, { color: colors.warning || '#F59E0B' }]}>
                        Atenção: seu cartão já compromete parte relevante da renda.
                      </Text>
                    </View>
                  )}
                  {report.debtPercentage <= 30 && (
                    <View style={[styles.contextualFeedback, { backgroundColor: colors.successBg }]}>
                      <Text style={[styles.feedbackText, { color: colors.income }]}>
                        Seu comprometimento está dentro do recomendado.
                      </Text>
                    </View>
                  )}

                  {/* Compromissos futuros */}
                  {futureCommitments.length > 0 && (
                    <View style={styles.futureCommitmentsSimple}>
                      <Text style={[styles.futureCommitmentsTitle, { color: colors.text }]}>
                        Próximos meses
                      </Text>
                      
                      {futureCommitments.slice(0, 3).map((commitment) => {
                        const emoji = commitment.percentage <= 30 ? '🟢' : commitment.percentage <= 40 ? '🟡' : '🔴';
                        const monthShort = commitment.monthName.substring(0, 3);
                        const yearShort = commitment.year.toString().substring(2);
                        
                        return (
                          <View key={`${commitment.year}-${commitment.month}`} style={[styles.futureMonthSimple, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.futureMonthLabel, { color: colors.text }]}>
                              {monthShort}/{yearShort}
                            </Text>
                            <Text style={[styles.futureMonthValue, { color: colors.textMuted }]}>
                              {formatCurrencyBRL(commitment.totalAmount)}
                            </Text>
                            <Text style={styles.futureMonthEmoji}>
                              {emoji}
                            </Text>
                          </View>
                        );
                      })}
                      
                      {futureCommitments.length > 3 && (
                        <View style={styles.futureInfoMessage}>
                          <MaterialCommunityIcons name="information-outline" size={14} color={colors.textMuted} />
                          <Text style={[styles.futureInfoText, { color: colors.textMuted }]}>
                            Esta projeção serve como um alerta. Para acompanhamento detalhado, consulte a fatura do seu cartão.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <View style={[styles.salaryInfo, { backgroundColor: colors.grayLight }]}>
                  <MaterialCommunityIcons name="information" size={16} color={colors.textMuted} />
                  <Text style={[styles.salaryText, { color: colors.textMuted }]}>
                    Cadastre uma receita com categoria "Renda" para ver o percentual comprometido e acompanhar a saúde financeira
                  </Text>
                </View>
              )}
            </View>

            {/* Evolução do saldo */}
            <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryBg }]}>
                  <MaterialCommunityIcons name="chart-line" size={24} color={colors.primary} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Evolução do saldo</Text>
              </View>
              
              <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
                Comparação com o mês anterior
              </Text>

              {/* Comparação de saldos */}
              <View style={styles.balanceComparison}>
                <View style={styles.balanceComparisonItem}>
                  <Text style={[styles.comparisonLabel, { color: colors.textMuted }]}>
                    Mês anterior
                  </Text>
                  <Text style={[styles.comparisonValue, { 
                    color: savingsEvolution.previous >= 0 ? colors.income : colors.expense 
                  }]}>
                    {formatCurrencyBRL(savingsEvolution.previous)}
                  </Text>
                  <ProgressBar 
                    label=""
                    value={Math.abs(savingsEvolution.previous)}
                    maxValue={maxBalance}
                    color={savingsEvolution.previous >= 0 ? colors.income : colors.expense}
                    colors={colors}
                  />
                </View>

                <View style={styles.balanceComparisonItem}>
                  <Text style={[styles.comparisonLabel, { color: colors.textMuted }]}>
                    Mês atual
                  </Text>
                  <Text style={[styles.comparisonValue, { 
                    color: savingsEvolution.current >= 0 ? colors.income : colors.expense 
                  }]}>
                    {formatCurrencyBRL(savingsEvolution.current)}
                  </Text>
                  <ProgressBar 
                    label=""
                    value={Math.abs(savingsEvolution.current)}
                    maxValue={maxBalance}
                    color={savingsEvolution.current >= 0 ? colors.income : colors.expense}
                    colors={colors}
                  />
                </View>
              </View>

              {/* Diferença */}
              <View style={[styles.evolutionDifference, { 
                backgroundColor: savingsEvolution.improved ? colors.successBg : colors.dangerBg 
              }]}>
                <MaterialCommunityIcons 
                  name={savingsEvolution.improved ? 'trending-up' : 'trending-down'} 
                  size={20} 
                  color={savingsEvolution.improved ? colors.income : colors.expense} 
                />
                <Text style={[styles.evolutionText, { 
                  color: savingsEvolution.improved ? colors.income : colors.expense 
                }]}>
                  {savingsEvolution.improved ? 'Aumentou' : 'Diminuiu'} {formatCurrencyBRL(Math.abs(savingsEvolution.difference))}
                </Text>
              </View>
            </View>

            {/* Top categorias de gastos */}
            <ExpensesByCategoryCard 
              expenses={categoryExpenses}
              totalExpenses={report?.expense || 0}
              maxItems={5}
              showTitle={true}
            />

          </View>
        </View>
      </ScrollView>
    </MainLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  centeredContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statsGridMobile: {
    flexDirection: 'column',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  balanceComparison: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  balanceComparisonItem: {
    gap: spacing.xs,
  },
  comparisonLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  evolutionDifference: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  evolutionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  futureRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  futureItem: {
    flex: 1,
  },
  futureLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  futureValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  salaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  salaryText: {
    fontSize: 12,
    flex: 1,
  },
  healthZone: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  healthZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  healthZoneInfo: {
    paddingLeft: spacing.sm,
  },
  healthZoneText: {
    fontSize: 11,
    lineHeight: 16,
  },
  evolutionChart: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  progressItem: {
    gap: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    minWidth: 4,
  },
  evolutionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  evolutionText: {
    fontSize: 13,
    flex: 1,
  },
  healthStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  healthStatusEmoji: {
    fontSize: 32,
  },
  healthStatusTextContainer: {
    flex: 1,
  },
  healthStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  healthStatusSubtitle: {
    fontSize: 13,
  },
  healthSummary: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  healthHighlights: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  healthHighlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  healthHighlightText: {
    fontSize: 13,
    flex: 1,
  },
  healthAdvice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  healthAdviceText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  // Novos estilos para Compromissos de cartão refatorado
  infoIcon: {
    marginLeft: 'auto',
    opacity: 0.6,
  },
  infoTooltip: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  commitmentMain: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  commitmentPercentage: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  commitmentAmount: {
    fontSize: 14,
  },
  incomeReference: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  contextualFeedback: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  feedbackText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  futureCommitmentsSimple: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  futureMonthSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  futureMonthLabel: {
    fontSize: 13,
    fontWeight: '600',
    width: 60,
  },
  futureMonthValue: {
    fontSize: 13,
    flex: 1,
  },
  futureMonthEmoji: {
    fontSize: 18,
  },
  futureInfoMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  futureInfoText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
    fontStyle: 'italic',
  },
  futureCommitments: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  futureCommitmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  futureCommitmentsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  futureCommitmentsDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  futureMonthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  futureMonthLeft: {
    flex: 1,
  },
  futureMonthName: {
    fontSize: 13,
    fontWeight: '600',
  },
  futureMonthAmount: {
    fontSize: 12,
    marginTop: 2,
  },
  futureMonthRight: {
    alignItems: 'flex-end',
  },
  futureMonthPercent: {
    fontSize: 16,
    fontWeight: '700',
  },
  futureWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  futureWarningText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
});
