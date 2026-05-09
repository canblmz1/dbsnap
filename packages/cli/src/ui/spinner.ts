export async function withSpinner<T>(_message: string, task: () => Promise<T>): Promise<T> {
  return await task();
}
