import { useBrandColours } from '@/modules/branding/hooks/useBranding'
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
  /** A tall, centred, letter-spaced field for a one-time code. */
  code?: boolean
  className?: string
}

export function TextField({ label, error, secret, mono, code, className, ...input }: TextFieldProps) {
  const brand = useBrandColours()
  const [revealed, setRevealed] = useState(false)
  const [focused, setFocused] = useState(false)

  return (
    <View className={className}>
      <Text className="mb-1.5 font-sans-medium text-sm text-slate-700">{label}</Text>
      <View
        className={cn(
          'flex-row items-center rounded-xl border bg-white px-3.5',
          code ? 'h-14' : 'h-12',
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
          // The typing cursor and selection in the brand teal (Android; the browser ignores these).
          cursorColor={brand.primary}
          selectionColor={`${brand.primary}40`}
          accessibilityLabel={label}
          className={cn('flex-1 text-slate-900', code ? 'text-center text-2xl' : 'text-base', mono || code ? 'font-mono' : 'font-sans')}
          // minWidth 0: a browser input won't shrink below its intrinsic width, which the spaced code digits exceed.
          style={code ? { letterSpacing: 10, minWidth: 0 } : { minWidth: 0 }}
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
