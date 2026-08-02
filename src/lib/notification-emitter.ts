import { EventEmitter } from 'events';

// Create a global event emitter for notifications
// Ensure this survives Hot Module Replacement (HMR) in dev
const globalForEmitter = global as unknown as { notificationEmitter: EventEmitter };

export const notificationEmitter =
  globalForEmitter.notificationEmitter || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitter.notificationEmitter = notificationEmitter;
}

notificationEmitter.setMaxListeners(50);

// Function to push a notification globally
export function pushNotification(payload: { title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' }) {
  notificationEmitter.emit('new_notification', payload);
}
