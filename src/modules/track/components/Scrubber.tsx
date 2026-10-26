import { useMemo, useRef } from 'react'
import { PanResponder, View, type AccessibilityActionEvent } from 'react-native'

// React Native has no built-in slider and a native one would be a new
// dependency for one control, so this is tap-or-drag over a plain bar.
export function Scrubber({
  value,
  max,
  onChange,
  label,
}: {
  value: number
  max: number
  onChange: (next: number) => void
  label: string
}) {
  const width = useRef(1)
  const latest = useRef({ max, onChange })
  latest.current = { max, onChange }

  const responder = useMemo(() => {
    const move = (x: number) => {
      const ratio = Math.min(1, Math.max(0, x / width.current))
      latest.current.onChange(Math.round(ratio * latest.current.max))
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => move(event.nativeEvent.locationX),
      onPanResponderMove: (event) => move(event.nativeEvent.locationX),
    })
  }, [])

  const ratio = max > 0 ? value / max : 0

  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => {
        width.current = Math.max(1, event.nativeEvent.layout.width)
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1))
        if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(0, value - 1))
      }}
      // select-none: dragging the bar in a browser would otherwise select the page's text (web only).
      className="select-none"
      style={{ height: 44, justifyContent: 'center' }}
    >
      <View pointerEvents="none" className="h-1.5 rounded-full bg-slate-200">
        <View className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${ratio * 100}%` }} />
      </View>
      <View
        pointerEvents="none"
        className="absolute h-5 w-5 rounded-full border-2 border-white bg-brand-primary shadow"
        style={{ left: `${ratio * 100}%`, marginLeft: -10 }}
      />
    </View>
  )
}
