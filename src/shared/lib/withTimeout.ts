export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms} ms`)
    this.name = 'TimeoutError'
  }
}

/** The promise's own result, or a TimeoutError if it takes longer than `ms` (the work itself isn't cancelled). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
