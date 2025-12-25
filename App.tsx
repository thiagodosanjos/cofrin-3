import RootNavigation from "./src/navigation";
import { AuthProvider } from "./src/contexts/authContext";
import { ThemeProvider } from "./src/contexts/themeContext";
import { SystemNavigationBar } from "./src/components/SystemNavigationBar";
import { TransactionsProvider } from './src/state/transactionsContext';
import { TransactionRefreshProvider } from './src/contexts/transactionRefreshContext';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMemo, useEffect, useState } from 'react';
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
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      // Pequeno delay para garantir que a UI está pronta
      const timer = setTimeout(() => {
        setAppIsReady(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

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

  if (!appIsReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#5B3CC4" />
      </View>
    );
  }

  return (
    <RecoilRootImpl>
      <SafeAreaProvider>
        <ThemeProvider>
          <SystemNavigationBar />
          <PaperProvider theme={paperTheme}>
            <TransactionsProvider>
              <TransactionRefreshProvider>
                <AuthProvider>
                  <RootNavigation />
                </AuthProvider>
              </TransactionRefreshProvider>
            </TransactionsProvider>
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </RecoilRootImpl>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
