import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { getToken } from './src/services/auth';
import LoginScreen         from './src/screens/LoginScreen';
import HomeScreen          from './src/screens/HomeScreen';
import LogEventScreen      from './src/screens/LogEventScreen';
import HistoryScreen       from './src/screens/HistoryScreen';
import CreateProductScreen from './src/screens/CreateProductScreen';
import ManualLogScreen     from './src/screens/ManualLogScreen';
import AccountScreen       from './src/screens/AccountScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ icon, focused }) {
  return (
    <Text style={{ fontSize: 20, color: focused ? '#6FC49A' : 'rgba(208,235,224,0.35)' }}>
      {icon}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1A2E22',
          borderTopColor: 'rgba(45,106,79,0.3)',
          paddingBottom: 20,
          paddingTop: 8,
          height: 72,
        },
        tabBarActiveTintColor:   '#6FC49A',
        tabBarInactiveTintColor: 'rgba(208,235,224,0.35)',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
      }}
    >
      <Tab.Screen
        name="Products"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⊞" focused={focused} /> }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⊛" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    getToken()
      .then((token) => setHasToken(!!token))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A2E22' }}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={hasToken ? 'Main' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login"         component={LoginScreen} />
        <Stack.Screen name="Main"          component={MainTabs} />
        <Stack.Screen name="LogEvent"      component={LogEventScreen} />
        <Stack.Screen name="History"       component={HistoryScreen} />
        <Stack.Screen name="CreateProduct" component={CreateProductScreen} />
        <Stack.Screen name="ManualLog"     component={ManualLogScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}