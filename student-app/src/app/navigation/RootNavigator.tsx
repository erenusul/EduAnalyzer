import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { LoginScreen } from '../../screens/auth/LoginScreen';
import { ResultsScreen } from '../../screens/results/ResultsScreen';
import { ResultDetailScreen } from '../../screens/results/ResultDetailScreen';
import { AvailableExamsScreen } from '../../screens/scan/AvailableExamsScreen';
import { ScanScreen } from '../../screens/scan/ScanScreen';
import type { AuthStackParamList, ResultsStackParamList, ScanStackParamList, StudentTabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ResultsStack = createNativeStackNavigator<ResultsStackParamList>();
const ScanStack = createNativeStackNavigator<ScanStackParamList>();
const Tabs = createBottomTabNavigator<StudentTabParamList>();

function ResultsNavigator() {
  return (
    <ResultsStack.Navigator>
      <ResultsStack.Screen name="ResultsList" component={ResultsScreen} options={{ title: 'Sonuçlarım' }} />
      <ResultsStack.Screen name="ResultDetail" component={ResultDetailScreen} options={{ title: 'Sonuç Detayı' }} />
    </ResultsStack.Navigator>
  );
}

function ScanNavigator() {
  return (
    <ScanStack.Navigator>
      <ScanStack.Screen name="AvailableExams" component={AvailableExamsScreen} options={{ title: 'Sınav Seç' }} />
      <ScanStack.Screen name="ScanExam" component={ScanScreen} options={{ title: 'Optik Tara' }} />
    </ScanStack.Navigator>
  );
}

function StudentTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="ResultsTab" component={ResultsNavigator} options={{ title: 'Sonuçlar' }} />
      <Tabs.Screen name="ScanTab" component={ScanNavigator} options={{ title: 'Optik Tarama' }} />
    </Tabs.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f8fa' }}>
      <ActivityIndicator size="large" color="#0d6efd" />
      <Text style={{ marginTop: 12, color: '#5e6278' }}>Oturum hazırlanıyor...</Text>
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
          primary: '#0d6efd',
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
