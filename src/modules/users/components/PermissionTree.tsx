import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import type { ApiPermission } from '@/shared/constants/backend-permissions'
import { countAreas, flattenTree, rowState, selectAll, toggleManage, toggleView, type Grantable } from '../lib/permissionTree'

function Box({ on, disabled, label, onPress, size = 22 }: { on: boolean; disabled?: boolean; label: string; onPress: () => void; size?: number }) {
  return (
    <Pressable
      hitSlop={8}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      onPress={onPress}
      style={{ width: size, height: size }}
      className={cn('items-center justify-center rounded border', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300 bg-white', disabled && 'opacity-40')}
    >
      {on ? <Feather name="check" size={size - 8} color="#FFFFFF" /> : null}
    </Pressable>
  )
}

// "View" grants the plain code and "Can change" the _MANAGE code,
// which includes view, so only one of the two is ever stored.
export function PermissionTree({
  granted,
  available,
  grantable,
  onChange,
  disabled,
}: {
  granted: ApiPermission[]
  available: ApiPermission[]
  grantable: Grantable
  onChange: (next: ApiPermission[]) => void
  disabled?: boolean
}) {
  const areas = countAreas(granted)
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm text-slate-500">
          {areas} {areas === 1 ? 'area' : 'areas'} selected
        </Text>
        <View className="flex-row gap-4">
          <Pressable hitSlop={8} disabled={disabled} onPress={() => onChange(selectAll(available, grantable))}>
            <Text className="font-sans-medium text-sm text-brand-primary">Select all</Text>
          </Pressable>
          <Pressable hitSlop={8} disabled={disabled} onPress={() => onChange([])}>
            <Text className="font-sans-medium text-sm text-slate-600">Unselect all</Text>
          </Pressable>
        </View>
      </View>

      <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {flattenTree().map(({ node, depth }) => {
          const s = rowState(node, granted, available, grantable)
          if (s.hidden) return null
          if (s.heading) {
            return (
              <View key={node.label} className="border-t border-slate-100 bg-slate-50 px-3 py-2" style={{ paddingLeft: 12 + depth * 14 }}>
                <Text className="font-sans-semibold text-xs uppercase tracking-wide text-slate-400">{node.label}</Text>
              </View>
            )
          }
          return (
            <View key={node.label} className="min-h-14 flex-row items-center gap-3 border-t border-slate-100 px-3 py-2" style={{ paddingLeft: 12 + depth * 14 }}>
              <Box on={s.viewing} disabled={disabled || (!s.viewAllowed && !s.viewing)} label={`${node.label}: view`} onPress={() => onChange(toggleView(granted, node))} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm text-slate-800">{node.label}</Text>
                {node.hint ? <Text className="text-[11px] leading-4 text-slate-400">{node.hint}</Text> : null}
              </View>
              {s.manage ? (
                <View className="flex-row items-center gap-1.5">
                  <Box
                    size={20}
                    on={s.managing}
                    disabled={disabled || (!s.manageAllowed && !s.managing)}
                    label={`${node.label}: can change`}
                    onPress={() => onChange(toggleManage(granted, node))}
                  />
                  <Text className={cn('text-xs', s.viewing ? 'text-slate-600' : 'text-slate-400')}>Can change</Text>
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
      {grantable !== null ? <Text className="mt-2 text-xs leading-5 text-slate-500">You can only grant permissions you hold yourself.</Text> : null}
    </View>
  )
}
