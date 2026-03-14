import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminDashboard from './screens/AdminDashboard';
import NodeArchitect from './screens/NodeArchitect';
import ModerationHUD from './screens/ModerationHUD';
import CategoryManager from './screens/CategoryManager';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="AdminDashboard"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="NodeArchitect" component={NodeArchitect} />
        <Stack.Screen name="ModerationHUD" component={ModerationHUD} />
        <Stack.Screen name="CategoryManager" component={CategoryManager} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
