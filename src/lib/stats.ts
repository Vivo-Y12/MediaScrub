/** Legacy aggregate counter endpoint retained for API compatibility. No client telemetry is sent. */
export async function pingStats(_files: number): Promise<void> { return; }
export async function readStats(): Promise<{ filesProcessed: number } | null> { return null; }
