import { Platform } from 'react-native'
import { Tabs } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { MODULES, type IconName, type ModuleKey } from '@/shared/constants/modules'
import { navigationPosition, useLayout } from '@/shared/lib/layout'
import { useCan } from '@/shared/lib/permissions'
import { useAlarms } from '@/modules/alarms/hooks/useAlarms'
import { broadcastAvailable } from '@/modules/group-call/api/broadcast.api'

/**
 * Hidden from the bar but still a place you can go. (`href: null` would remove the route altogether, so a link to it,
 * from More on a narrow screen, would fall back to the first tab.)
 */
const unlessShown = (shown: boolean) => (shown ? {} : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } })

const iconOf = (key: ModuleKey): IconName => MODULES.find((m) => m.key === key)!.icon
const labelOf = (key: ModuleKey): string => MODULES.find((m) => m.key === key)!.label

export default function TabsLayout() {
  // A tab appears only if the signed-in account may read that module. Today
  // every live account is a full administrator, so all of them show; the
  // mock operator account (OP-014) is how to see the restricted layout.
  const canDashboard = useCan('dashboard:read')
  const canDevices = useCan('devices:read')
  const canMap = useCan('map:read')
  const canAlarms = useCan('alarms:read')
  const canTrack = useCan('trackPlayback:read')
  const canGroupCall = useCan('groupCall:read') && broadcastAvailable()
  const canAdmins = useCan('users:read')
  const canWifi = useCan('wifi:read')
  const { active } = useAlarms()
  // A tablet (600 dp and up, in portrait or landscape) gets a rail down the left edge, like the web's sidebar, which
  // has room for every module. A narrow screen gets a bottom bar, which doesn't: the extra modules stay in More.
  const { size } = useLayout()
  const rail = navigationPosition(size) === 'left'

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarPosition: rail ? 'left' : 'bottom',
        tabBarVariant: rail ? 'material' : undefined,
        // Labels under the icons make a slim rail. Beside them, the navigator reserves a
        // proportional sidebar (~360 dp at 960), which would leave the detail pane too narrow.
        tabBarLabelPosition: rail ? 'below-icon' : undefined,
        tabBarActiveTintColor: '#0A6659',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          // react-native-web squeezes the label to 10px and clips it. A taller
          // bar fixes the browser preview; native keeps its own defaults,
          // which already handle safe-area insets.
          ...(Platform.OS === 'web' && !rail ? { height: 64, paddingBottom: 8 } : {}),
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
        name="map"
        options={{
          title: labelOf('map'),
          href: canMap ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Feather name={iconOf('map')} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          // These four are in the rail where there is one, and in More where there isn't room.
          ...unlessShown(rail && canTrack),
          tabBarIcon: ({ color, size }) => <Feather name="navigation" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="group-call"
        options={{
          title: 'Group call',
          ...unlessShown(rail && canGroupCall),
          tabBarIcon: ({ color, size }) => <Feather name="radio" size={size} color={color as string} />,
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
        name="admins"
        options={{
          title: 'Admins',
          ...unlessShown(rail && canAdmins),
          tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="wifi"
        options={{
          title: 'Wi-Fi',
          ...unlessShown(rail && canWifi),
          tabBarIcon: ({ color, size }) => <Feather name="wifi" size={size} color={color as string} />,
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
