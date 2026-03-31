import React, { useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Colors, Radius } from '@/constants';

interface Props { value: string; onChange: (v: string) => void; length?: number }

export function OTPInput({ value, onChange, length = 6 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(length, '').split('').slice(0, length);

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      {digits.map((d, i) => (
        <View key={i} style={[styles.box, i === value.length ? styles.active : null]}>
          <TextInput
            ref={i === 0 ? inputRef : undefined}
            style={styles.digit}
            value={d === ' ' ? '' : d}
            editable={false}
            maxLength={1}
          />
        </View>
      ))}
      <TextInput
        ref={inputRef}
        style={styles.hidden}
        value={value}
        onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        caretHidden
        autoFocus
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box: {
    width: 38, height: 46, borderRadius: Radius.sm,
    borderWidth: 2, borderColor: '#e0e0e0',
    alignItems: 'center', justifyContent: 'center',
  },
  active: { borderColor: Colors.g, backgroundColor: Colors.gx },
  digit: { fontSize: 20, fontWeight: '700', color: Colors.t },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
