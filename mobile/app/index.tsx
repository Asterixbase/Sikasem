import { View, ActivityIndicator } from 'react-native';

export default function RootIndex() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1B6B3A" />
    </View>
  );
}
