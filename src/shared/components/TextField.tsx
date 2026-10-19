import { useState } from 'react'
import { Pressable, TextInput, View, type TextInputProps } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { cn } from '@/shared/lib/cn'
import { Text } from './Text'

interface TextFieldProps extends Omit<TextInputProps, 'className'> {
  label: string
  error?: string | null
  /** Password-style field with a show/hide toggle. */
  secret?: boolean
  mono?: boolean
  className?: string
}

export function TextField({ label, error, secret, mono, className, ...input }: TextFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <View className={className}>
      <Text className="mb-1.5 font-sans-medium text-sm text-slate-700">{label}</Text>
      <View
        className={cn(
          'h-12 flex-row items-center rounded-xl border bg-white px-3.5',
          error ? 'border-red-500' : focused ? 'border-brand-primary' : 'border-slate-300'
        )}
      >
        <TextInput
          {...input}
          secureTextEntry={secret && !revealed}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            input.onBlur?.(e)
          }}
          placeholderTextColor="#94A3B8"
          accessibilityLabel={label}
          className={cn('flex-1 text-base text-slate-900', mono ? 'font-mono' : 'font-sans')}
        />
        {secret ? (
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((v) => !v)}
          >
            <Feather name={revealed ? 'eye-off' : 'eye'} size={18} color="#64748B" />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="mt-1.5 text-sm text-red-600">{error}</Text> : null}
    </View>
  )
}
