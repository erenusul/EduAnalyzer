import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/app/providers/AuthProvider';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { AppThemeProvider, useAppTheme } from './src/theme/AppThemeContext';

function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function AppRoot() {
  return (
    <>
      <ThemedStatusBar />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AuthProvider>
          <AppRoot />
        </AuthProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
