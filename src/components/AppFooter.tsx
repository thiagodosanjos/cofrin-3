import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/themeContext';
import { spacing, getShadow } from '../theme';

type Props = {
  onHome: () => void;
  onAdd: () => void;
  onLaunches: () => void;
  onReports: () => void;
  onOthers: () => void;
};

// Compact bar height for all platforms (row height only; paddings are added separately)
export const FOOTER_HEIGHT = 56;

export default function AppFooter({ onHome, onAdd, onLaunches, onReports, onOthers }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Cor fixa para ícones inativos - cinza escuro para boa legibilidade
  const inactiveIconColor = '#64748b';

  const IconButton = ({ icon, onPress, isActive }: { icon: string; onPress: () => void; isActive?: boolean }) => (
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
        color={isActive ? colors.primary : inactiveIconColor} 
      />
    </Pressable>
  );

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
              <IconButton icon="home-outline" onPress={onHome} />
            </View>

            <View style={styles.slot}>
              <IconButton icon="swap-horizontal" onPress={onLaunches} />
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
              <IconButton icon="chart-bar" onPress={onReports} />
            </View>

            <View style={styles.slot}>
              <IconButton icon="dots-horizontal" onPress={onOthers} />
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
