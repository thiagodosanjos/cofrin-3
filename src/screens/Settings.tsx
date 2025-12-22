import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/themeContext";
import { useAuth } from "../contexts/authContext";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { useState, useMemo } from "react";
import CustomAlert from "../components/CustomAlert";
import MainLayout from "../components/MainLayout";
import SimpleHeader from "../components/SimpleHeader";
import { FOOTER_HEIGHT } from "../components/AppFooter";
import { spacing, borderRadius, getShadow } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logout } from "../services/auth";

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
  const [deleting, setDeleting] = useState(false);

  const bottomPad = useMemo(
    () => FOOTER_HEIGHT + 6 + Math.max(insets.bottom, 8) + spacing.lg,
    [insets.bottom]
  );

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const userEmail = user?.email || '';

  const menuItems: MenuItem[] = [
    { id: "edit_profile", label: "Editar perfil", icon: "account-edit", screen: "EditProfile" },
    { id: "accounts", label: "Configurar contas", icon: "bank", screen: "ConfigureAccounts" },
    { id: "cards", label: "Configurar cartões de crédito", icon: "credit-card", screen: "CreditCards" },
    { id: "categories", label: "Configurar categorias", icon: "tag-multiple", screen: "Categories" },
  ];

  const secondaryItems: MenuItem[] = [
    { id: "education", label: "Educação financeira", icon: "school-outline", screen: "Education" },
    { id: "about", label: "Sobre o app", icon: "information-outline", screen: "About" },
  ];

  const logoutItem: MenuItem = { id: "logout", label: "Sair do aplicativo", icon: "logout" };

  const dangerItems: MenuItem[] = [
    { id: "delete_account", label: "Deletar conta", icon: "delete-forever", danger: true },
  ];

  const handleLogout = () => {
    showAlert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              showAlert('Erro', 'Não foi possível sair da conta');
            }
          }
        },
      ]
    );
  };

  function handlePress(item: MenuItem) {
    if (item.id === 'delete_account') {
      handleDeleteAccount();
    } else if (item.id === 'logout') {
      handleLogout();
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  }

  async function handleDeleteAccount() {
    showAlert(
      'Deletar conta',
      'Tem certeza que deseja deletar sua conta? Todos os seus dados serão permanentemente removidos e essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  }

  async function confirmDeleteAccount() {
    if (!user?.uid) return;

    setDeleting(true);
    try {
      // Importar serviços necessários
      const { deleteDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { deleteUser, reauthenticateWithCredential, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithPopup } = await import('firebase/auth');
      const { db, COLLECTIONS, auth } = await import('../services/firebase');

      // Deletar todas as coleções do usuário
      const collectionsToDelete = [
        COLLECTIONS.TRANSACTIONS,
        COLLECTIONS.CATEGORIES,
        COLLECTIONS.ACCOUNTS,
        COLLECTIONS.CREDIT_CARDS,
        COLLECTIONS.CREDIT_CARD_BILLS,
        COLLECTIONS.GOALS,
      ];

      for (const collectionName of collectionsToDelete) {
        const q = query(
          collection(db, collectionName),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        
        // Deletar documentos em lotes
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      }

      // Deletar a conta do Firebase Auth
      if (user) {
        try {
          await deleteUser(user as any);
        } catch (authError: any) {
          // Se precisar de reautenticação, tentar reautenticar
          if (authError.code === 'auth/requires-recent-login') {
            const currentUser = auth.currentUser;
            if (currentUser) {
              // Verificar o provedor de login
              const providerId = currentUser.providerData[0]?.providerId;
              
              if (providerId === 'google.com') {
                // Reautenticar com Google
                const provider = new GoogleAuthProvider();
                await reauthenticateWithPopup(currentUser, provider);
              } else {
                // Para email/senha, mostrar mensagem para fazer logout e login novamente
                showAlert(
                  'Sessão expirada',
                  'Por segurança, faça logout e login novamente para deletar sua conta.',
                  [{ text: 'OK', style: 'default' }]
                );
                setDeleting(false);
                return;
              }
              
              // Tentar deletar novamente após reautenticação
              await deleteUser(currentUser);
            }
          } else {
            throw authError;
          }
        }
      }

      // Garantir logout após deletar a conta
      try {
        await logout();
      } catch {
        // Ignora erro de logout se usuário já foi removido
      }

      showAlert('Conta deletada', 'Sua conta e todos os dados foram removidos com sucesso.');
    } catch (error: any) {
      console.error('Erro ao deletar conta:', error);
      showAlert('Erro', error.message || 'Não foi possível deletar a conta. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  }

  function renderMenuItem(item: MenuItem, isLast: boolean) {
    const iconBgColor = item.danger ? colors.dangerBg : colors.primaryBg;
    const iconColor = item.danger ? colors.danger : colors.primary;
    const textColor = item.danger ? colors.danger : colors.text;

    return (
      <View key={item.id}>
        <Pressable
          onPress={() => handlePress(item)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? colors.grayLight : 'transparent' },
          ]}
          disabled={deleting}
        >
          <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
            <MaterialCommunityIcons name={item.icon as any} size={20} color={iconColor} />
          </View>
          <Text style={[styles.rowText, { color: textColor }]}>{item.label}</Text>
          {deleting && item.danger ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <MaterialCommunityIcons 
              name="chevron-right"
              size={20} 
              color={colors.textMuted} 
            />
          )}
        </Pressable>
        {!isLast && (
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        )}
      </View>
    );
  }

  return (
    <MainLayout>
      <ScrollView 
        style={[styles.scrollView, { backgroundColor: colors.bg }]} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        {/* Header simples */}
        <SimpleHeader title="Configurações" />

      {/* Cards de menu */}
      <View style={styles.centeredContainer}>
        <View style={styles.menuContainer}>
        {/* Menu principal */}
        <View style={styles.section}>
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

        {/* Sair do aplicativo */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#C2410C' }]}>
            SAIR DO APLICATIVO
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: pressed ? colors.grayLight : 'transparent' },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: '#FED7AA' }]}>
                <MaterialCommunityIcons name="logout" size={20} color="#C2410C" />
              </View>
              <Text style={[styles.rowText, { color: '#C2410C' }]}>{logoutItem.label}</Text>
              <MaterialCommunityIcons 
                name="chevron-right"
                size={20} 
                color={colors.textMuted} 
              />
            </Pressable>
          </View>
        </View>

        {/* Zona de perigo */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>
            ZONA DE PERIGO
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
            {dangerItems.map((item, idx) => renderMenuItem(item, idx === dangerItems.length - 1))}
          </View>
        </View>
        </View>
      </View>
      </ScrollView>
      <CustomAlert {...alertState} onClose={hideAlert} />
    </MainLayout>
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
    paddingTop: 10,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  menuContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
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
