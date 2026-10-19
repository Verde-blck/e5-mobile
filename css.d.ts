// Lets TypeScript accept `import '../../global.css'`. Metro + NativeWind turn
// that import into styles at build time; there is nothing to type.
declare module '*.css'
