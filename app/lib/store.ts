export type RoutinePayload = Record<string, unknown>;

type StoreEntry = {
  routine: RoutinePayload;
  savedAt: number;
};

const store = new Map<string, StoreEntry>();

export function generateRef(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function saveRoutine(payload: RoutinePayload): string {
  const ref = generateRef();
  store.set(ref, { routine: payload, savedAt: Date.now() });
  return ref;
}

export function getRoutine(ref: string): RoutinePayload | undefined {
  return store.get(ref)?.routine;
}

export function attachPlan(ref: string, planName: string): void {
  const entry = store.get(ref);
  if (entry) {
    entry.routine = {
      ...entry.routine,
      plan: { name: planName, confirmed: false },
    };
  }
}

export function confirmPlan(ref: string): void {
  const entry = store.get(ref);
  if (entry) {
    const plan = (entry.routine.plan as Record<string, unknown> | undefined) || {};
    const next = { ...plan, confirmed: true };
    entry.routine = { ...entry.routine, plan: next };
  }
}