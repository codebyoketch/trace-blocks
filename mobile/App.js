import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getToken } from './src/services/auth';
import LoginScreen    from './src/screens/LoginScreen';
import HomeScreen     from './src/screens/HomeScreen';
import ScanScreen     from './src/screens/ScanScreen';
import LogEventScreen from './src/screens/LogEventScreen';
import HistoryScreen  from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [checking, setChecking] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Check for a stored token on startup — skip login if already signed in
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
        initialRouteName={hasToken ? 'Home' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login"    component={LoginScreen} />
        <Stack.Screen name="Home"     component={HomeScreen} />
        <Stack.Screen name="Scan"     component={ScanScreen} />
        <Stack.Screen name="LogEvent" component={LogEventScreen} />
        <Stack.Screen name="History"  component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}