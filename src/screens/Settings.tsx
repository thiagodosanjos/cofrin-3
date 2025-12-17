import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/themeContext";
import { useAuth } from "../contexts/authContext";
import { useCustomAlert } from "../hooks/useCustomAlert";
import CustomAlert from "../components/CustomAlert";
import SettingsFooter from "../components/SettingsFooter";
import { spacing, borderRadius, getShadow } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo } from "react";

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  screen?: string;
  danger?: boolean;
}

export default function Settings({ navigation }: any) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();

  const bottomPad = useMemo(
    () => 56 + spacing.sm + Math.max(insets.bottom, 8) + spacing.lg,
    [insets.bottom]
  );

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const userEmail = user?.email || '';

  const menuItems: MenuItem[] = [
    { id: "edit_profile", label: "Editar perfil", icon: "account-edit", screen: "EditProfile" },
    { id: "accounts", label: "Configurar contas", icon: "bank", screen: "ConfigureAccounts" },
    { id: "cards", label: "Cartões de crédito", icon: "credit-card", screen: "CreditCards" },
    { id: "categories", label: "Categorias", icon: "tag-multiple", screen: "Categories" },
  ];

  const secondaryItems: MenuItem[] = [
    { id: "education", label: "Educação financeira", icon: "school-outline", screen: "Education" },
    { id: "about", label: "Sobre o app", icon: "information-outline", screen: "About" },
  ];

  function handlePress(item: MenuItem) {
    if (item.screen) {
      navigation.navigate(item.screen);
    }
  }

  function renderMenuItem(item: MenuItem, isLast: boolean) {
    return (
      <View key={item.id}>
        <Pressable
          onPress={() => handlePress(item)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? colors.grayLight : 'transparent' },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryBg }]}>
            <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primary} />
          </View>
          <Text style={[styles.rowText, { color: colors.text }]}>{item.label}</Text>
          <MaterialCommunityIcons 
            name="chevron-right"
            size={20} 
            color={colors.textMuted} 
          />
        </Pressable>
        {!isLast && (
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        {/* Header com perfil */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerInner}>
          {/* Botão voltar */}
          <Pressable 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </Pressable>

          <View style={styles.profileSection}>
            <View style={styles.avatarCircle}>
              <MaterialCommunityIcons name="account" size={40} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userEmail}>{userEmail}</Text>
            </View>
            <Pressable 
              onPress={() => navigation.navigate('EditProfile')}
              style={styles.editButton}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Cards de menu */}
      <View style={styles.centeredContainer}>
        <View style={styles.menuContainer}>
        {/* Menu principal */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            CONFIGURAÇÕES
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
            {menuItems.map((item, idx) => renderMenuItem(item, idx === menuItems.length - 1))}
          </View>
        </View>

        {/* Menu secundário */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            SUPORTE
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
            {secondaryItems.map((item, idx) => renderMenuItem(item, idx === secondaryItems.length - 1))}
          </View>
        </View>
        </View>
      </View>
      </ScrollView>
      <CustomAlert {...alertState} onClose={hideAlert} />
      <SettingsFooter navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centeredContainer: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
  },
  headerInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowText: { 
    fontSize: 16, 
    flex: 1,
  },
  divider: {
    height: 1,
    marginLeft: 62,
  },
});
