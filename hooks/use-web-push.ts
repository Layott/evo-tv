"use client";

import * as React from "react";

/**
 * Browser push, the half that was missing.
 *
 * The server has been able to send a Web Push since the notifications work
 * landed: `lib/push` signs with VAPID, `/api/push/subscribe` stores the
 * subscription, `public/sw.js` shows the notification. Nothing ever called
 * `navigator.serviceWorker.register`, so no browser was ever subscribed and
 * every send counted zero deliveries.
 *
 * States are deliberately explicit rather than a boolean. "This browser
 * cannot" and "you blocked it in Chrome" need different words on screen, and
 * neither is fixable by flipping a switch.
 */
export type WebPushState =
  /** Still reading the browser's current permission and subscription. */
  | "loading"
  /** No service worker, no PushManager, or an insecure origin. */
  | "unsupported"
  /** Blocked at the browser level. Only the site settings can undo this. */
  | "denied"
  /** Supported and allowed, but this browser has no subscription. */
  | "off"
  /** Subscribed, and the server holds the keys to reach it. */
  | "on";

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    // localhost counts as secure, which is what makes this testable in dev.
    window.isSecureContext
  );
}

export function useWebPush() {
  const [state, setState] = React.useState<WebPushState>("loading");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!supported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        // `getRegistration` rather than `register`: reading the current state
        // must not install a worker on a page the visitor never opted into.
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = React.useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return false;
      }

      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) {
        // 503 means the server has no VAPID pair. Nothing the visitor can do.
        setError("Push is not configured on this server yet.");
        setState("off");
        return false;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const reg = await navigator.serviceWorker.register("/sw.js");
      // A worker that is still installing cannot receive a push, and the
      // subscription would look fine while the first message went nowhere.
      await navigator.serviceWorker.ready;

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          // Chrome rejects a silent subscription outright.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            publicKey,
          ) as unknown as BufferSource,
        }));

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError("The browser returned an incomplete subscription.");
        setState("off");
        return false;
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
      if (!res.ok) {
        // Leaving the browser subscribed while the server has no record is the
        // one state that looks working and is not, so undo it.
        await sub.unsubscribe().catch(() => {});
        setError(
          res.status === 401
            ? "Sign in first, so the notification knows where to go."
            : "Could not save this browser on your account.",
        );
        setState("off");
        return false;
      }

      setState("on");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn on push.");
      setState("off");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = React.useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        // Server first: if the browser unsubscribes and the delete fails, the
        // row lingers and every later send burns a request on a dead endpoint.
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
