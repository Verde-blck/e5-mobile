import { useLocalSearchParams } from 'expo-router'
import { AlarmDetailView } from '@/modules/alarms/components/AlarmDetailView'

export default function AlarmRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <AlarmDetailView id={id} />
}
