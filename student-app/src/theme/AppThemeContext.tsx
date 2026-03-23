import { createContext, useContext, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { getAppThemeColors, type AppThemeColors } from './colors';

interface AppThemeContextValue {
  isDark: boolean;
  colors: AppThemeColors;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const value = useMemo<AppThemeContextValue>(
    () => ({
      isDark,
      colors: getAppThemeColors(isDark),
    }),
    [isDark]
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}
