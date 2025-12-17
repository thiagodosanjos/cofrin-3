import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/themeContext";
import { spacing, borderRadius, getShadow } from "../theme";
import SettingsFooter from "../components/SettingsFooter";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Dicas práticas de educação financeira
const TIPS = [
  {
    icon: "piggy-bank",
    title: "Reserve antes de gastar",
    description: "Separe um percentual da sua renda assim que receber, antes de pagar as contas. Mesmo que seja pouco, o hábito faz diferença."
  },
  {
    icon: "credit-card-off",
    title: "Use o cartão com consciência",
    description: "Mantenha o uso do cartão abaixo de 30% da sua renda. Isso evita comprometer demais seu orçamento."
  },
  {
    icon: "chart-line",
    title: "Acompanhe seus gastos",
    description: "Registre todas as despesas para saber para onde está indo seu dinheiro. Pequenos gastos somam muito no final do mês."
  },
  {
    icon: "target",
    title: "Tenha metas claras",
    description: "Definir objetivos financeiros concretos te ajuda a manter o foco e a disciplina para poupar."
  }
];

// Livros recomendados
const BOOKS = [
  {
    title: "Pai Rico, Pai Pobre",
    author: "Robert Kiyosaki",
    description: "Clássico sobre educação financeira e mentalidade de riqueza."
  },
  {
    title: "Os Segredos da Mente Milionária",
    author: "T. Harv Eker",
    description: "Como reprogramar sua mente para o sucesso financeiro."
  },
  {
    title: "Me Poupe!",
    author: "Nathalia Arcuri",
    description: "Guia prático e direto de finanças pessoais para brasileiros."
  }
];

// Frase motivacional do Julius
const JULIUS_QUOTE = "Dinheiro não dá em árvore! 💰";

export default function Education({ navigation }: any) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const bottomPad = useMemo(
    () => 56 + spacing.sm + Math.max(insets.bottom, 8) + spacing.lg,
    [insets.bottom]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Educação Financeira</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.centeredContainer}>
          <View style={styles.content}>
            
            {/* Mensagem do Julius */}
            <View style={[styles.juliusCard, { backgroundColor: colors.warningBg || '#FEF3C7' }]}>
              <MaterialCommunityIcons name="lightbulb-on" size={32} color={colors.warning || '#F59E0B'} />
              <Text style={[styles.juliusQuote, { color: colors.text }]}>
                {JULIUS_QUOTE}
              </Text>
              <Text style={[styles.juliusName, { color: colors.textMuted }]}>
                — Julius, Everybody Hates Chris
              </Text>
            </View>

            {/* Dicas práticas */}
            <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="school" size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Dicas Práticas
                </Text>
              </View>
              
              {TIPS.map((tip, index) => (
                <View key={index} style={[styles.tipItem, index > 0 && { marginTop: spacing.md }]}>
                  <View style={[styles.tipIcon, { backgroundColor: colors.primaryBg }]}>
                    <MaterialCommunityIcons name={tip.icon as any} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.tipContent}>
                    <Text style={[styles.tipTitle, { color: colors.text }]}>
                      {tip.title}
                    </Text>
                    <Text style={[styles.tipDescription, { color: colors.textMuted }]}>
                      {tip.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Livros recomendados */}
            <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="book-open-variant" size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Livros Recomendados
                </Text>
              </View>
              
              {BOOKS.map((book, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.bookItem, 
                    { borderBottomColor: colors.border },
                    index === BOOKS.length - 1 && { borderBottomWidth: 0 }
                  ]}
                >
                  <View style={[styles.bookIcon, { backgroundColor: colors.primaryBg }]}>
                    <MaterialCommunityIcons name="book" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.bookContent}>
                    <Text style={[styles.bookTitle, { color: colors.text }]}>
                      {book.title}
                    </Text>
                    <Text style={[styles.bookAuthor, { color: colors.textMuted }]}>
                      {book.author}
                    </Text>
                    <Text style={[styles.bookDescription, { color: colors.textMuted }]}>
                      {book.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Call to action */}
            <View style={[styles.ctaCard, { backgroundColor: colors.primaryBg }]}>
              <MaterialCommunityIcons name="hand-coin" size={32} color={colors.primary} />
              <Text style={[styles.ctaText, { color: colors.text }]}>
                O conhecimento é o primeiro passo para a liberdade financeira. Continue aprendendo e aplicando!
              </Text>
            </View>

          </View>
        </View>
      </ScrollView>

      <SettingsFooter navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: spacing.lg,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centeredContainer: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  content: {
    padding: spacing.lg,
  },
  juliusCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  juliusQuote: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  juliusName: {
    fontSize: 13,
    fontStyle: "italic",
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  tipItem: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  tipDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  bookItem: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  bookIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bookContent: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  bookAuthor: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  bookDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  ctaCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  ctaText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
