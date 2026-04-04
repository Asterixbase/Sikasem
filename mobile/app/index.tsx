import { View, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants';

export default function RootIndex() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.w }}>
      <ActivityIndicator size="large" color={Colors.g} />
    </View>
  );
}
