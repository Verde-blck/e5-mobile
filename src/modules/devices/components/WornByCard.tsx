import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Card, Row } from '@/shared/components/Card'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { confirmAction } from '@/shared/lib/confirm'
import { useCan } from '@/shared/lib/permissions'
import { useAssignWorker, useRemoveWorker } from '../hooks/useWorker'
import { describeWorkerError, formFromWorker, validateWorker, workerPayload, type WorkerErrors, type WorkerForm } from '../lib/worker'
import type { Device } from '../types'

/**
 * Who a helmet is assigned to. Alarm notifications then say whose helmet it is ("SOS: John Ade (ES5 3)"). Anyone who can see the
 * helmet sees the name; changing it needs Monitoring Center management.
 */
export function WornByCard({ device }: { device: Device }) {
  const canAssign = useCan('devices:write')
  const assign = useAssignWorker(device.id)
  const remove = useRemoveWorker(device.id)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<WorkerForm>(formFromWorker(device.worker))
  const [errors, setErrors] = useState<WorkerErrors>({})
  const [problem, setProblem] = useState<string | null>(null)
  const worker = device.worker

  function open() {
    setForm(formFromWorker(worker))
    setErrors({})
    setProblem(null)
    setEditing(true)
  }

  function save() {
    const found = validateWorker(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setProblem(null)
    assign.mutate(workerPayload(form), { onSuccess: () => setEditing(false), onError: (e) => setProblem(describeWorkerError(e)) })
  }

  function askRemove() {
    confirmAction({
      title: `Remove ${worker?.name ?? 'the worker'} from this helmet?`,
      message: 'Alarm notifications will no longer name anyone for it.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => {
        setProblem(null)
        remove.mutate(undefined, { onError: (e) => setProblem(describeWorkerError(e)) })
      },
    })
  }

  return (
    <Card className="mb-5 py-1">
      {editing ? (
        <View className="gap-3 py-3">
          <TextField label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} error={errors.name} placeholder="John Ade" maxLength={80} autoCapitalize="words" />
          <TextField label="Staff number (optional)" value={form.staffId} onChangeText={(staffId) => setForm({ ...form, staffId })} placeholder="E5-014" autoCapitalize="characters" />
          <TextField label="Phone (optional)" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} placeholder="+234 803 123 4567" keyboardType="phone-pad" />
          {problem ? <Text accessibilityRole="alert" className="text-sm text-red-600">{problem}</Text> : null}
          <View className="flex-row gap-2">
            <Button title="Save" className="h-11 flex-1" loading={assign.isPending} onPress={save} />
            <Button title="Cancel" variant="secondary" className="h-11 flex-1" disabled={assign.isPending} onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : (
        <>
          <Row label="Worn by" value={worker?.name ?? 'Unassigned'} last={!worker?.staffId && !worker?.phone && !canAssign} />
          {worker?.staffId ? <Row label="Staff number" value={worker.staffId} last={!worker.phone && !canAssign} /> : null}
          {worker?.phone ? <Row label="Phone" value={worker.phone} last={!canAssign} /> : null}
          {problem ? <Text accessibilityRole="alert" className="pb-2 text-sm text-red-600">{problem}</Text> : null}
          {canAssign ? (
            <View className="flex-row gap-2 py-3">
              <Button title={worker ? 'Change' : 'Assign worker'} variant="secondary" icon="user" className="h-10 flex-1" onPress={open} />
              {worker ? <Button title="Remove" variant="secondary" icon="user-x" className="h-10 flex-1" loading={remove.isPending} onPress={askRemove} /> : null}
            </View>
          ) : null}
        </>
      )}
    </Card>
  )
}
