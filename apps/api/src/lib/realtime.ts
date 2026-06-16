const REALTIME_SERVER_INTERNAL_URL = process.env.REALTIME_SERVER_INTERNAL_URL || 'http://localhost:4000';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  console.warn('[realtime] INTERNAL_SECRET not configured, events will not be emitted');
}

export async function emitEvent(room: string, event: string, payload: any): Promise<void> {
  if (!INTERNAL_SECRET) {
    console.warn('[realtime] Skipping emit - INTERNAL_SECRET not configured');
    return;
  }

  try {
    const response = await fetch(`${REALTIME_SERVER_INTERNAL_URL}/internal/emit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTERNAL_SECRET}`,
      },
      body: JSON.stringify({ room, event, payload }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[realtime] Failed to emit event: ${response.status} ${errorText}`);
      return;
    }

    console.log(`[realtime] Emitted ${event} to room ${room}`);
  } catch (error) {
    console.error('[realtime] Error emitting event:', error);
  }
}
