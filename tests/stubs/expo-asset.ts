export const Asset = { fromModule: (asset: unknown) => ({ uri: typeof asset === 'string' ? asset : 'asset://test' }) }
