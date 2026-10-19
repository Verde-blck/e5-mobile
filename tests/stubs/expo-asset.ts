// Sample-data alarms resolve bundled photos/clips to a URI; the tests only need that to return a string.
export const Asset = { fromModule: (asset: unknown) => ({ uri: typeof asset === 'string' ? asset : 'asset://test' }) }
