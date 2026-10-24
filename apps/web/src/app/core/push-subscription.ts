export function readPushSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.ready.then((registration) =>
    registration.pushManager?.getSubscription() ?? null,
  );
}
