import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { AvailableExam, ExamResult } from '../../types/exam';

export type ResultsStackParamList = {
  ResultsList: undefined;
  ResultDetail: { result: ExamResult };
  ProgressChart: undefined;
};

export type ScanStackParamList = {
  AvailableExams: undefined;
  ScanExam: { exam: AvailableExam };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Help: undefined;
  Settings: undefined;
};

export type StudentTabParamList = {
  ResultsTab: NavigatorScreenParams<ResultsStackParamList>;
  ScanTab: NavigatorScreenParams<ScanStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type ResultsScreenProps = NativeStackScreenProps<ResultsStackParamList, 'ResultsList'>;
export type ResultDetailScreenProps = NativeStackScreenProps<ResultsStackParamList, 'ResultDetail'>;
export type ProgressChartScreenProps = NativeStackScreenProps<ResultsStackParamList, 'ProgressChart'>;
export type AvailableExamsScreenProps = NativeStackScreenProps<ScanStackParamList, 'AvailableExams'>;
export type ScanScreenProps = NativeStackScreenProps<ScanStackParamList, 'ScanExam'>;
export type ProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;
export type HelpScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Help'>;
export type SettingsScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;
export type ResultsTabScreenProps = BottomTabScreenProps<StudentTabParamList, 'ResultsTab'>;
export type ScanTabScreenProps = BottomTabScreenProps<StudentTabParamList, 'ScanTab'>;
export type ProfileTabScreenProps = BottomTabScreenProps<StudentTabParamList, 'ProfileTab'>;
