import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/themeContext';
import { spacing, getShadow } from '../theme';

type Props = {
  onHome: () => void;
  onAdd: () => void;
  onLaunches: () => void;
  onCategories: () => void;
  onSettings: () => void;
};

// Compact bar height for all platforms (row height only; paddings are added separately)
export const FOOTER_HEIGHT = 56;

export default function AppFooter({ onHome, onAdd, onLaunches, onCategories, onSettings }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute();

  // Detectar rota ativa
  const currentRoute = route.name;

  // Cores do design system
  const activeIconColor = '#4A2FA8';    // roxo escuro para ícone ativo
  const inactiveIconColor = '#9A96B0'; // cinza arroxeado para ícone inativo

  const IconButton = ({ 
    icon, 
    onPress, 
    routeName 
  }: { 
    icon: string; 
    onPress: () => void; 
    routeName: string;
  }) => {
    const isActive = currentRoute === routeName;
    
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.iconButton,
          { opacity: pressed ? 0.7 : 1 }
        ]}
        hitSlop={8}
      >
        <MaterialCommunityIcons 
          name={icon as any} 
          size={24} 
          color={isActive ? activeIconColor : inactiveIconColor} 
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.safeArea}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          getShadow(colors, 'lg'),
        ]}
      >
        <View style={styles.centeredContent}>
          <View style={styles.row}>
            <View style={styles.slot}>
              <IconButton icon="home-outline" onPress={onHome} routeName="Bem-vindo" />
            </View>

            <View style={styles.slot}>
              <IconButton icon="swap-horizontal" onPress={onLaunches} routeName="Lançamentos" />
            </View>

            <View style={styles.centerSlot}>
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel="Adicionar"
                style={({ pressed }) => [
                  styles.plusButton, 
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.9 }
                ]}
                hitSlop={12}
              >
                <MaterialCommunityIcons name="plus" size={28} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.slot}>
              <IconButton icon="chart-pie" onPress={onCategories} routeName="CategoryDetails" />
            </View>

            <View style={styles.slot}>
              <IconButton icon="cog-outline" onPress={onSettings} routeName="Configurações" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  centeredContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  row: {
    height: FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    padding: spacing.sm,
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    }),
  },
});
