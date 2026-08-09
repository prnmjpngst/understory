import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Library: undefined;
  Search: undefined;
  Chat: undefined;
  Inbox: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;
  Editor: { docId: number };
};