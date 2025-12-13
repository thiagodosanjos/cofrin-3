import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Surface, IconButton, useTheme } from 'react-native-paper';

type Props = {
  onHome: () => void;
  onAdd: () => void;
  onReports: () => void;
};

// Footer height closer to reference (low profile bar + big central FAB)
export const FOOTER_HEIGHT = 32;

export default function AppFooter({ onHome, onAdd, onReports }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <Surface
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
        elevation={1}
      >
        <View style={styles.row}>
          <View style={styles.slot}>
            <IconButton icon="home-outline" onPress={onHome} size={26} />
          </View>

          <View style={styles.centerSlot}>
            <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Adicionar" style={[styles.plusButton, { backgroundColor: theme.colors.primary }]}
              hitSlop={10}
            >
              <IconButton icon="plus" iconColor="#fff" size={28} />
            </Pressable>
          </View>

          <View style={styles.slot}>
            <IconButton icon="chart-bar" onPress={onReports} size={26} />
          </View>
        </View>
      </Surface>
    </SafeAreaView>
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
    paddingTop: 10,
    paddingHorizontal: 26,
  },
  row: {
    height: FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slot: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSlot: {
    width: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButton: {
    width: 46,
    height: 46,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
