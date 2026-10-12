// System notifications (macOS Notification Center via the browser) for the
// moments you'd otherwise miss in a background tab: a bot needs your OK, a run
// finished, a run ended early. Off until you turn them on in the TopBar; only
// shown while the lounge isn't the page you're looking at.

const KEY = 'ai-lounge-notify'

export const notifySupported = typeof window !== 'undefined' && 'Notification' in window

export function notifyPermission(): NotificationPermission | 'unsupported' {
  return notifySupported ? Notification.permission : 'unsupported'
}

export function loadNotifyPref(): boolean {
  try {
    return notifySupported && localStorage.getItem(KEY) === '1' && Notification.permission === 'granted'
  } catch {
    return false
  }
}

export function saveNotifyPref(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Asks the browser (from a click). Resolves to whether notifications may show. */
export async function requestNotify(): Promise<boolean> {
  if (!notifySupported) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

const lookingAtLounge = () => document.visibilityState === 'visible' && document.hasFocus()

/** Shows a notification unless you're already looking at the lounge. Clicking it focuses the tab. */
export function notify(title: string, body: string, tag: string, onClick: () => void) {
  if (!notifySupported || Notification.permission !== 'granted' || lookingAtLounge()) return
  try {
    const n = new Notification(title, { body, tag, icon: '/favicon.svg' })
    n.onclick = () => {
      window.focus()
      onClick()
      n.close()
    }
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}
