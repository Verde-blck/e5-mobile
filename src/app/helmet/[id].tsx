import { useLocalSearchParams } from 'expo-router'
import { HelmetDetailView } from '@/modules/devices/components/HelmetDetailView'

export default function HelmetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <HelmetDetailView id={id} />
}
