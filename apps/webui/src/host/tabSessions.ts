const sessions = new Map<number, number>();

export const noteTabSession = (browserId: number, sessionId: number) => void sessions.set(browserId, sessionId);

export const forgetTabSession = (browserId: number) => void sessions.delete(browserId);

export function browserIdsOfSession(sessionId: number): number[] {
  const ids: number[] = [];
  for (const [browserId, session] of sessions) if (session === sessionId) ids.push(browserId);
  return ids;
}
