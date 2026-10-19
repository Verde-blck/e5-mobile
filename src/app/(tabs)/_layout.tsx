import { Platform } from 'react-native'
import { Tabs } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { MODULES, type IconName, type ModuleKey } from '@/shared/constants/modules'
import { useLayout } from '@/shared/lib/layout'
import { useCan } from '@/shared/lib/permissions'
import { useAlarms } from '@/modules/alarms/hooks/useAlarms'

const iconOf = (key: ModuleKey): IconName => MODULES.find((m) => m.key === key)!.icon
const labelOf = (key: ModuleKey): string => MODULES.find((m) => m.key === key)!.label

export default function TabsLayout() {
  // A tab appears only if the signed-in account may read that module. Today
  // every live account is a full administrator, so all of them show; the
  // mock operator account (OP-014) is how to see the restricted layout.
  const canDashboard = useCan('dashboard:read')
  const canDevices = useCan('devices:read')
  const canAlarms = useCan('alarms:read')
  const { active } = useAlarms()
  // Wide screens (a tablet in landscape) get a rail down the left edge instead of a bottom bar.
  const { twoPane } = useLayout()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: twoPane ? 'left' : 'bottom',
        tabBarVariant: twoPane ? 'material' : undefined,
        // Labels under the icons make a slim rail. Beside them, the navigator reserves a
        // proportional sidebar (~360 dp at 960), which would leave the detail pane too narrow.
        tabBarLabelPosition: twoPane ? 'below-icon' : undefined,
        tabBarActiveTintColor: '#0A6659',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          // react-native-web squeezes the label to 10px and clips it. A taller
          // bar fixes the browser preview; native keeps its own defaults,
          // which already handle safe-area insets.
          ...(Platform.OS === 'web' && !twoPane ? { height: 64, paddingBottom: 8 } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: labelOf('dashboard'),
          // href: null removes the tab from the bar. The screen itself also
          // redirects (RequirePermission), so landing on "/" still works.
          href: canDashboard ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('dashboard')} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Monitoring',
          href: canDevices ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('devices')} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="alarms"
        options={{
          title: 'Alarms',
          href: canAlarms ? undefined : null,
          // Unresolved alarms of any severity; critical ones are also in the banner.
          tabBarBadge: active.length > 0 ? active.length : undefined,
          tabBarBadgeStyle: { backgroundColor: '#DC2626', color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('alarms')} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Feather name="menu" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  )
}
