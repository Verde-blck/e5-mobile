export const Platform = { OS: 'ios', select: (o: any) => o.ios ?? o.default }
export const Alert = { alert: () => {} }
export const Linking = { openURL: async () => {} }

export const Dimensions = { get: (_: string) => ({ width: (globalThis as any).__testWidth ?? 390, height: 844 }) }
export function useWindowDimensions() { return Dimensions.get('window') }
