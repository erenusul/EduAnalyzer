import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { LoginScreen } from '../../screens/auth/LoginScreen';
import { ResultsScreen } from '../../screens/results/ResultsScreen';
import { ResultDetailScreen } from '../../screens/results/ResultDetailScreen';
import { AvailableExamsScreen } from '../../screens/scan/AvailableExamsScreen';
import { ScanScreen } from '../../screens/scan/ScanScreen';
import { ProfileScreen } from '../../screens/profile/ProfileScreen';
import type { AuthStackParamList, ResultsStackParamList, ScanStackParamList, ProfileStackParamList, StudentTabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ResultsStack = createNativeStackNavigator<ResultsStackParamList>();
const ScanStack = createNativeStackNavigator<ScanStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tabs = createBottomTabNavigator<StudentTabParamList>();

function ResultsNavigator() {
  return (
    <ResultsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#181c32', fontWeight: '800' },
        headerTintColor: '#5ce1e6',
      }}
    >
      <ResultsStack.Screen name="ResultsList" component={ResultsScreen} options={{ title: 'Sonuçlarım' }} />
      <ResultsStack.Screen name="ResultDetail" component={ResultDetailScreen} options={{ title: 'Sınav Detayı' }} />
    </ResultsStack.Navigator>
  );
}

function ScanNavigator() {
  return (
    <ScanStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#181c32', fontWeight: '800' },
        headerTintColor: '#5ce1e6',
      }}
    >
      <ScanStack.Screen name="AvailableExams" component={AvailableExamsScreen} options={{ title: 'Sınav Seç' }} />
      <ScanStack.Screen name="ScanExam" component={ScanScreen} options={{ title: 'Optik Tara' }} />
    </ScanStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#181c32', fontWeight: '800' },
      }}
    >
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profilim' }} />
    </ProfileStack.Navigator>
  );
}

function StudentTabs() {
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

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#5ce1e6',
        tabBarInactiveTintColor: '#737373',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e4e6ef',
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12,
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
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f8fa' }}>
      <ActivityIndicator size="large" color="#5ce1e6" />
      <Text style={{ marginTop: 12, color: '#737373', fontSize: 15, fontWeight: '500' }}>Oturum hazırlanıyor...</Text>
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: '#f5f8fa',
          card: '#ffffff',
          primary: '#5ce1e6',
          text: '#181c32',
          border: '#e4e6ef',
        },
      }}
    >
      {isAuthenticated ? (
        <StudentTabs />
      ) : (
        <AuthStack.Navigator>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Öğrenci Girişi' }} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
