import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../contexts/themeContext';
import { spacing, borderRadius } from '../theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: { current: number; total: number } | null;
}

/**
 * Overlay de carregamento que bloqueia toda a interação do usuário
 * Use para operações longas que precisam garantir que o usuário não clique em nada
 */
export default function LoadingOverlay({ 
  visible, 
  message = 'Processando...', 
  progress 
}: LoadingOverlayProps) {
  const { colors } = useAppTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.message, { color: colors.text }]}>
            {message}
          </Text>
          {progress && (
            <View style={styles.progressContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { backgroundColor: colors.grayLight }
                ]}
              >
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      backgroundColor: colors.primary,
                      width: `${(progress.current / progress.total) * 100}%` 
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {progress.current} de {progress.total}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '80%',
    maxWidth: 280,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    gap: spacing.xs,
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
