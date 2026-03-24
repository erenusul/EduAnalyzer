import {
  NavigationContainer,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useAppTheme } from '../../theme/AppThemeContext';
import { LoginScreen } from '../../screens/auth/LoginScreen';
import { ResultsScreen } from '../../screens/results/ResultsScreen';
import { ResultDetailScreen } from '../../screens/results/ResultDetailScreen';
import { ProgressChartScreen } from '../../screens/results/ProgressChartScreen';
import { AvailableExamsScreen } from '../../screens/scan/AvailableExamsScreen';
import { ScanScreen } from '../../screens/scan/ScanScreen';
import { ProfileScreen } from '../../screens/profile/ProfileScreen';
import { HelpScreen } from '../../screens/profile/HelpScreen';
import { SettingsScreen } from '../../screens/profile/SettingsScreen';
import type {
  AuthStackParamList,
  ProfileStackParamList,
  ResultsStackParamList,
  ScanStackParamList,
  StudentTabParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ResultsStack = createNativeStackNavigator<ResultsStackParamList>();
const ScanStack = createNativeStackNavigator<ScanStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tabs = createBottomTabNavigator<StudentTabParamList>();

function ResultsNavigator() {
  const { colors, isDark } = useAppTheme();
  return (
    <ResultsStack.Navigator
      screenOptions={{
        headerStyle: { 
          backgroundColor: colors.headerBackground,
        },
        headerTitleStyle: { 
          color: colors.textPrimary, 
          fontWeight: '900',
          fontSize: 18,
        },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ResultsStack.Screen name="ResultsList" component={ResultsScreen} options={{ title: 'Sonuçlarım' }} />
      <ResultsStack.Screen name="ResultDetail" component={ResultDetailScreen} options={{ title: 'Sınav Detayı' }} />
      <ResultsStack.Screen name="ProgressChart" component={ProgressChartScreen} options={{ title: 'Gelişim' }} />
    </ResultsStack.Navigator>
  );
}

function ScanNavigator() {
  const { colors, isDark } = useAppTheme();
  return (
    <ScanStack.Navigator
      screenOptions={{
        headerStyle: { 
          backgroundColor: colors.headerBackground,
        },
        headerTitleStyle: { 
          color: colors.textPrimary, 
          fontWeight: '900',
          fontSize: 18,
        },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ScanStack.Screen name="AvailableExams" component={AvailableExamsScreen} options={{ title: 'Sınav Seç' }} />
      <ScanStack.Screen name="ScanExam" component={ScanScreen} options={{ title: 'Optik Tara' }} />
    </ScanStack.Navigator>
  );
}

function ProfileNavigator() {
  const { colors, isDark } = useAppTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { 
          backgroundColor: colors.headerBackground,
        },
        headerTitleStyle: { 
          color: colors.textPrimary, 
          fontWeight: '900',
          fontSize: 18,
        },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profilim' }} />
      <ProfileStack.Screen name="Help" component={HelpScreen} options={{ title: 'Yardım' }} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
    </ProfileStack.Navigator>
  );
}

function StudentTabs() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabBarBottomInset = Math.max(insets.bottom, 10);
  const tabBarMinHeight = 52 + tabBarBottomInset;

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help';

          if (route.name === 'ResultsTab') {
            iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          } else if (route.name === 'ScanTab') {
            iconName = focused ? 'scan-circle' : 'scan-circle-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          const iconSize = Math.max(size, 26);
          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          paddingTop: 10,
          paddingBottom: tabBarBottomInset,
          minHeight: tabBarMinHeight,
        },
        tabBarItemStyle: {
          paddingTop: 4,
          paddingBottom: 2,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12,
          marginBottom: 2,
        },
      })}
    >
      <Tabs.Screen name="ResultsTab" component={ResultsNavigator} options={{ title: 'Sonuçlar' }} />
      <Tabs.Screen name="ScanTab" component={ScanNavigator} options={{ title: 'Tarama' }} />
      <Tabs.Screen name="ProfileTab" component={ProfileNavigator} options={{ title: 'Profil' }} />
    </Tabs.Navigator>
  );
}

function LoadingScreen() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
      accessibilityLabel="Yükleniyor"
    >
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 15, fontWeight: '500' }}>Oturum hazırlanıyor...</Text>
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isDark } = useAppTheme();

  const navTheme = isDark
    ? {
        ...NavigationDarkTheme,
        colors: {
          ...NavigationDarkTheme.colors,
          primary: colors.accent,
          background: colors.background,
          card: colors.card,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.accent,
        },
      }
    : {
        ...NavigationDefaultTheme,
        colors: {
          ...NavigationDefaultTheme.colors,
          primary: colors.accent,
          background: colors.background,
          card: colors.card,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.accent,
        },
      };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? (
        <StudentTabs />
      ) : (
        <AuthStack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.headerBackground },
            headerTitleStyle: { color: colors.textPrimary, fontWeight: '800' },
            headerTintColor: colors.accent,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
