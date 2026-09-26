// Usage analytics (02-backend/services.md "Analytics"). Q-analytics: the same events as TV,
// `analyticsAppName` from config and the platform "android". Batching reproduces the TV.
import { config } from "@/config";

import { sha256Hex } from "./crypto";
import { send } from "./http";
import { readJson, type KeyValueStore } from "./store";

const P = config.app.storagePrefix;
export const ANALYTICS_ACTIVE_KEY = `${P}analytics_active`;
export const ANALYTICS_SESSIONS_KEY = `${P}analytics_sessions`;

export type AnalyticsTracker = "live_opened" | "movies_opened" | "series_opened";

export interface AnalyticsEvent {
  tracker: string;
  timestamp: number;
}

export interface AnalyticsSession {
  session_id: string;
  start_time: number;
  ip_address: string;
  userCountry: string;
  userCity: string;
  events: AnalyticsEvent[];
}

export interface AnalyticsDevice {
  platform: string;
  modelName: string;
  version: string;
  sdkVersion: string;
  screenWidth: number;
  screenHeight: number;
  uhd: boolean;
}

/** "s_" + SHA256(startTimeSeconds + "_" + mac); computed after the device id is known. */
export function sessionId(startSeconds: number, macAddress: string): string {
  return `s_${sha256Hex(`${startSeconds}_${macAddress}`)}`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export class Analytics {
  private uploading = false;

  constructor(
    private readonly store: KeyValueStore,
    private readonly context: { macAddress: string; appVersion: string; device: AnalyticsDevice },
  ) {}

  private sessions(): AnalyticsSession[] {
    return readJson<AnalyticsSession[]>(this.store, ANALYTICS_SESSIONS_KEY) ?? [];
  }

  private save(sessions: AnalyticsSession[]): void {
    // At most 10 sessions are kept; older ones are dropped.
    this.store.set(
      ANALYTICS_SESSIONS_KEY,
      JSON.stringify(sessions.slice(-config.analytics.maxBufferedSessions)),
    );
  }

  /** One session per app launch. */
  startSession(startSeconds: number = nowSeconds()): void {
    const id = sessionId(startSeconds, this.context.macAddress);
    this.store.set(
      ANALYTICS_ACTIVE_KEY,
      JSON.stringify({ sessionId: id, startTime: startSeconds }),
    );
    this.save([
      ...this.sessions(),
      {
        session_id: id,
        start_time: startSeconds,
        ip_address: "",
        userCountry: "",
        userCity: "",
        events: [],
      },
    ]);
  }

  /** ip / country / city: filled the first time they are known, never overwritten. */
  setLocation(location: { ip?: string; country?: string; city?: string }): void {
    const active = this.activeId();
    this.save(
      this.sessions().map((s) =>
        s.session_id !== active
          ? s
          : {
              ...s,
              ip_address: s.ip_address || location.ip || "",
              userCountry: s.userCountry || location.country || "",
              userCity: s.userCity || location.city || "",
            },
      ),
    );
  }

  private activeId(): string | undefined {
    return readJson<{ sessionId?: string }>(this.store, ANALYTICS_ACTIVE_KEY)?.sessionId;
  }

  bufferedCount(): number {
    return this.sessions().reduce((n, s) => n + s.events.length, 0);
  }

  /** Appends an event; uploads when ≥ 5 events are buffered. */
  async track(tracker: AnalyticsTracker, at: number = nowSeconds()): Promise<void> {
    const active = this.activeId();
    this.save(
      this.sessions().map((s) =>
        s.session_id === active ? { ...s, events: [...s.events, { tracker, timestamp: at }] } : s,
      ),
    );
    if (this.bufferedCount() >= config.analytics.uploadThresholdEvents) await this.upload();
  }

  /** After device_info: upload if ≥ 10 events, or the oldest is ≥ 24 h old. */
  shouldFlushAfterDeviceInfo(now: number = nowSeconds()): boolean {
    const events = this.sessions().flatMap((s) => s.events);
    if (events.length >= config.analytics.playlistFlushThreshold) return true;
    const oldest = Math.min(...events.map((e) => e.timestamp));
    return events.length > 0 && now - oldest >= config.analytics.maxEventAgeSeconds;
  }

  /** One upload at a time; on 2xx exactly the sent events are removed; on error all are kept. */
  async upload(): Promise<boolean> {
    if (this.uploading) return false;
    const sent = this.sessions().filter((s) => s.events.length > 0);
    if (sent.length === 0) return false;
    this.uploading = true;
    try {
      const response = await send({
        url: config.analytics.url,
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": config.analytics.apiKey },
        body: JSON.stringify({
          device: this.context.device,
          mac_address: this.context.macAddress,
          app_version: this.context.appVersion,
          app_name: config.analytics.appName,
          sessions: sent,
        }),
        timeoutMs: config.analytics.timeoutMs,
      });
      if (!response.ok) return false;
      const sentCount = new Map(sent.map((s) => [s.session_id, s.events.length]));
      this.save(
        this.sessions().map((s) => ({
          ...s,
          events: s.events.slice(sentCount.get(s.session_id) ?? 0),
        })),
      );
      return true;
    } catch {
      return false;
    } finally {
      this.uploading = false;
    }
  }
}
