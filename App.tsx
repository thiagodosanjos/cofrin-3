import RootNavigation from "./src/navigation";
import { AuthProvider } from "./src/contexts/authContext";
import { TransactionsProvider } from './src/state/transactionsContext';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { useFonts, Roboto_400Regular, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
let RecoilRootImpl: any = ({ children }: any) => <>{children}</>;
try {
  // Attempt to dynamically load Recoil; if it fails (as with incompatible React by web), fallback to a noop.
  // eslint-disable-next-line global-require
  const recoilPackage = require('recoil');
  if (recoilPackage?.RecoilRoot) RecoilRootImpl = recoilPackage.RecoilRoot;
} catch (e) {
  // No Recoil available or incompatible — we'll fallback to no-op wrapper
}

export default function App() {
  const [fontsLoaded] = useFonts({ Roboto_400Regular, Roboto_700Bold });

  const paperTheme = useMemo(
    () => ({
      ...DefaultTheme,
      roundness: 8,
      colors: {
        ...DefaultTheme.colors,
        primary: '#1565c0',
        accent: '#03dac4',
        background: '#f5f7fb',
        surface: '#ffffff',
        onSurface: '#111827',
      },
    }),
    []
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <RecoilRootImpl>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <TransactionsProvider>
            <AuthProvider>
              <RootNavigation />
            </AuthProvider>
          </TransactionsProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </RecoilRootImpl>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
