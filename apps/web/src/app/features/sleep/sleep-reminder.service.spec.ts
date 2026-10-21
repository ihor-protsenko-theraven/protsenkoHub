import { pushSubscriptionPayload } from './sleep-reminder.service';

describe('push subscription API payload', () => {
  it('excludes browser metadata that the API does not accept', () => {
    const subscription = {
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/wp/test',
        expirationTime: null,
        keys: { p256dh: 'public-key', auth: 'auth-secret' },
      }),
    };

    expect(pushSubscriptionPayload(subscription)).toEqual({
      endpoint: 'https://fcm.googleapis.com/wp/test',
      keys: { p256dh: 'public-key', auth: 'auth-secret' },
    });
  });
});
