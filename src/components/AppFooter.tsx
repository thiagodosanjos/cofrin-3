import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, IconButton, useTheme } from 'react-native-paper';

type Props = {
  onHome: () => void;
  onAdd: () => void;
  onLaunches: () => void;
  onGoals: () => void;
  onReports: () => void;
};

// Compact bar height for all platforms (row height only; paddings are added separately)
export const FOOTER_HEIGHT = 44;

export default function AppFooter({ onHome, onAdd, onLaunches, onGoals, onReports }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.safeArea}>
      <Surface
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            paddingBottom: Math.max(insets.bottom, 4),
            // Sombra para iOS
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            // Sombra para Android
            elevation: Platform.OS === 'android' ? 8 : 0,
          },
        ]}
        elevation={0}
      >
        <View style={styles.row}>
          <View style={styles.slot}>
            <IconButton icon="home-outline" onPress={onHome} size={24} />
          </View>

          <View style={styles.slot}>
            <IconButton icon="swap-horizontal" onPress={onLaunches} size={24} />
          </View>

          <View style={styles.centerSlot}>
            <Pressable
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel="Adicionar"
              style={[styles.plusButton, { backgroundColor: theme.colors.primary }]}
              hitSlop={12}
            >
              <IconButton icon="plus" iconColor="#fff" size={28} />
            </Pressable>
          </View>

          <View style={styles.slot}>
            <IconButton icon="chart-bar" onPress={onReports} size={24} />
          </View>

          <View style={styles.slot}>
            <IconButton icon="target" onPress={onGoals} size={24} />
          </View>
        </View>
      </Surface>
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
    paddingTop: 4,
    paddingHorizontal: 12,
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
  plusButton: {
    width: 52,
    height: 52,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
