import { Linking, Platform } from 'react-native'

/** Opens a coordinate in the phone's own maps app. */
export function openInMaps(lat: number, lng: number, label: string): void {
  const name = encodeURIComponent(label)
  const url = Platform.select({
    ios: `http://maps.apple.com/?ll=${lat},${lng}&q=${name}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${name})`,
    default: `https://www.google.com/maps?q=${lat},${lng}`,
  })
  void Linking.openURL(url)
}
