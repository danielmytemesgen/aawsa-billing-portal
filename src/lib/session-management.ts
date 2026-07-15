export type SessionActionType = 'logout' | 'revoke';

export function getSessionActionTitle(action: SessionActionType) {
  return action === 'logout' ? 'Sign out this browser' : 'Revoke active sessions';
}

export function getSessionActionDescription(action: SessionActionType) {
  return action === 'logout'
    ? 'End your current browser session and return to the sign-in page.'
    : 'Revoke the selected session immediately and require the user to sign in again.'
}
