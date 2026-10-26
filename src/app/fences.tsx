import { router } from 'expo-router'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { FenceListPanel } from '@/modules/fences/components/FenceListPanel'

function FencesScreen() {
  const selectFence = useSelectionStore((s) => s.selectFence)
  return (
    <Screen top={false}>
      <Container max={640}>
        <FenceListPanel
          onSelect={(id) => {
            selectFence(id)
            router.navigate('/map')
          }}
        />
      </Container>
    </Screen>
  )
}

export default function FencesRoute() {
  return (
    <RequirePermission permission="fences:read" fallback="/more">
      <FencesScreen />
    </RequirePermission>
  )
}
