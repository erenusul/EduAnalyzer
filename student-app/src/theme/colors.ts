export interface AppThemeColors {
  background: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  inputBackground: string;
  tabBar: string;
  tabBarBorder: string;
  errorBackground: string;
  headerBackground: string;
  shadow: string;
  accentMuted: string;
}

export function getAppThemeColors(isDark: boolean): AppThemeColors {
  if (isDark) {
    return {
      background: '#151521',
      card: '#1e1e2d',
      textPrimary: '#f5f8fa',
      textSecondary: '#a1a5b7',
      textMuted: '#7e8299',
      border: '#2b2b40',
      accent: '#5ce1e6',
      success: '#7ed957',
      danger: '#f1416c',
      warning: '#f6c000',
      inputBackground: '#2b2b40',
      tabBar: '#1e1e2d',
      tabBarBorder: '#2b2b40',
      errorBackground: 'rgba(241, 65, 108, 0.15)',
      headerBackground: '#1e1e2d',
      shadow: '#000000',
      accentMuted: 'rgba(92, 225, 230, 0.15)',
    };
  }

  return {
    background: '#f5f8fa',
    card: '#ffffff',
    textPrimary: '#181c32',
    textSecondary: '#5e6278',
    textMuted: '#737373',
    border: '#e4e6ef',
    accent: '#5ce1e6',
    success: '#7ed957',
    danger: '#d9214e',
    warning: '#f6c000',
    inputBackground: '#f5f8fa',
    tabBar: '#ffffff',
    tabBarBorder: '#e4e6ef',
    errorBackground: 'rgba(217, 33, 78, 0.1)',
    headerBackground: '#ffffff',
    shadow: '#5ce1e6',
    accentMuted: 'rgba(92, 225, 230, 0.1)',
  };
}
