import { Platform } from 'react-native'
import { Tabs } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { MODULES, type IconName, type ModuleKey } from '@/shared/constants/modules'
import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { navigationPosition, railItemHeight, useLayout } from '@/shared/lib/layout'
import { useCan } from '@/shared/lib/permissions'
import { useAlarms } from '@/modules/alarms/hooks/useAlarms'
import { liveAvailable } from '@/modules/live/api/live.api'

// `href: null` would remove the route altogether, so a link to it
// (from More on a narrow screen) would fall back to the first tab.
const unlessShown = (shown: boolean) => (shown ? {} : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } })

const iconOf = (key: ModuleKey): IconName => MODULES.find((m) => m.key === key)!.icon
const labelOf = (key: ModuleKey): string => MODULES.find((m) => m.key === key)!.label

export default function TabsLayout() {
  const canDashboard = useCan('dashboard:read')
  const canDevices = useCan('devices:read')
  const canMap = useCan('map:read')
  const canAlarms = useCan('alarms:read')
  const canWall = useCan('live:read') && liveAvailable()
  const canTrack = useCan('trackPlayback:read')
  const canGroupCall = (useCan('live:write') || useCan('groupCall:read')) && liveAvailable()
  const canAdmins = useCan('users:read')
  const { active } = useAlarms()
  const brand = useBrandColours()
  const { size, height } = useLayout()
  const rail = navigationPosition(size) === 'left'
  const railItems = [canDashboard, canDevices, rail && canWall, canMap, rail && canTrack, rail && canGroupCall, canAlarms, rail && canAdmins, true].filter(Boolean).length
  const itemHeight = rail ? railItemHeight(height, railItems) : undefined
  // A squeezed item has no room to spare: a smaller icon and a taller label box (descenders were being clipped).
  const iconSize = (size: number) => (itemHeight ? Math.min(size, 20) : size)

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarPosition: rail ? 'left' : 'bottom',
        tabBarVariant: rail ? 'material' : undefined,
        // Labels sit under the icons to keep the rail slim; beside them the navigator would
        // reserve a proportional sidebar (~360 dp at 960) and leave the detail pane too narrow.
        tabBarLabelPosition: rail ? 'below-icon' : undefined,
        tabBarItemStyle: itemHeight ? { height: itemHeight, paddingVertical: 0 } : undefined,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: itemHeight ? 16 : 14 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          // react-native-web squeezes the tab label to 10px and clips it, so the bar is made taller in the
          // browser preview; native keeps its own defaults, which already handle safe-area insets.
          ...(Platform.OS === 'web' && !rail ? { height: 64, paddingBottom: 8 } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: labelOf('dashboard'),
          href: canDashboard ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('dashboard')} size={iconSize(size)} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Monitoring',
          href: canDevices ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('devices')} size={iconSize(size)} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="wall"
        options={{
          title: 'Live wall',
          ...unlessShown(rail && canWall),
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={iconSize(size)} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: labelOf('map'),
          href: canMap ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('map')} size={iconSize(size)} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          ...unlessShown(rail && canTrack),
          tabBarIcon: ({ color, size }) => <Feather name="navigation" size={iconSize(size)} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="group-call"
        options={{
          title: 'Group call',
          ...unlessShown(rail && canGroupCall),
          tabBarIcon: ({ color, size }) => <Feather name="radio" size={iconSize(size)} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="alarms"
        options={{
          title: 'Alarms',
          href: canAlarms ? undefined : null,
          tabBarBadge: active.length > 0 ? active.length : undefined,
          tabBarBadgeStyle: { backgroundColor: '#DC2626', color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('alarms')} size={iconSize(size)} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="admins"
        options={{
          title: 'Admins',
          ...unlessShown(rail && canAdmins),
          tabBarIcon: ({ color, size }) => <Feather name="users" size={iconSize(size)} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Feather name="menu" size={iconSize(size)} color={color as string} />,
        }}
      />
    </Tabs>
  )
}
