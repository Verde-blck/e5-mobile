import type { ReactNode } from 'react'
import { View } from 'react-native'
import { cn } from '@/shared/lib/cn'
import { Text } from './Text'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('rounded-2xl border border-slate-200 bg-white p-4', className)}>
      {children}
    </View>
  )
}

export function SectionTitle({ children, className }: { children: string; className?: string }) {
  return (
    <Text className={cn('mb-2 font-sans-semibold text-xs uppercase tracking-wider text-slate-500', className)}>
      {children}
    </Text>
  )
}

/** A label on the left, a value on the right. The workhorse of detail screens. */
export function Row({
  label,
  value,
  mono,
  last,
}: {
  label: string
  value: string
  mono?: boolean
  last?: boolean
}) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between py-2.5',
        !last && 'border-b border-slate-100'
      )}
    >
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className={cn('text-sm text-slate-900', mono ? 'font-mono' : 'font-sans-medium')}>
        {value}
      </Text>
    </View>
  )
}
