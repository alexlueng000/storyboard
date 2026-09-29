"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  openDatabase,
  initializeLibrary,
  readLibrary,
  updateArtwork,
} from "./storage";
import { api } from "./api";

export function useLibrary(notify) {
  const [items, setItems] = useState([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [config, setConfig] = useState({ configured: false, loading: true });
  const db = useRef(null),
    token = useRef(""),
    itemsRef = useRef([]),
    mounted = useRef(false),
    channel = useRef(null);
  const publish = useCallback((next) => {
    itemsRef.current = next;
    if (mounted.current) setItems(next);
  }, []);
  const request = useCallback(
    (path, options) => api(token.current, path, options),
    [],
  );
  const update = useCallback(
    async (id, change, options) => {
      if (!db.current) throw new Error("画册尚未就绪，请稍后重试。");
      const next = await updateArtwork(db.current, id, change, options);
      publish(next);
      channel.current?.postMessage("updated");
      return next.find((item) => item.id === id);
    },
    [publish],
  );
  const refreshConfig = useCallback(async () => {
    try {
      const result = await request("/api/config");
      if (mounted.current) setConfig({ ...result, loading: false });
      return result;
    } catch (error) {
      if (mounted.current)
        setConfig({ configured: false, loading: false, error: error.message });
      return { configured: false, error: error.message };
    }
  }, [request]);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false,
      connection;
    setReady(false);
    setError("");
    (async () => {
      try {
        connection = await openDatabase();
        if (cancelled) {
          connection.close();
          return;
        }
        const data = await initializeLibrary(connection);
        if (cancelled) {
          connection.close();
          return;
        }
        db.current = connection;
        token.current = data.token;
        publish(data.items);
        setReady(true);
        refreshConfig();
      } catch (error) {
        connection?.close();
        if (!cancelled) setError(error.message || "当前浏览器无法打开画册。");
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
      connection?.close();
      if (db.current === connection) db.current = null;
    };
  }, [attempt, publish, refreshConfig]);
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    async function sync() {
      try {
        if (db.current) {
          const latest = await readLibrary(db.current);
          if (!stopped) publish(latest);
        }
      } catch (error) {
        if (!stopped) notify(error.message);
      }
    }
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("huahuole-library");
      channel.current.onmessage = sync;
    }
    const visible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [ready, publish, notify]);
  useEffect(() => {
    if (!ready) return;
    let stopped = false,
      timer;
    async function poll() {
      try {
        const latest = itemsRef.current;
        for (const item of latest) {
          if (stopped) return;
          const job = item.job;
          if (!job) continue;
          if (!job.real) {
            if (Date.now() - job.started >= 7500)
              await update(item.id, (current) =>
                current.job?.id === job.id
                  ? {
                      ...current,
                      job: undefined,
                      story: {
                        ready: true,
                        setting: job.setting,
                        delivered: Date.now(),
                        adjustments: 0,
                        variants: {},
                        previous: {},
                        position: 0,
                      },
                    }
                  : current,
              );
            continue;
          }
          if (["SUBMITTING", "FAILED", "CANCELLED"].includes(job.state))
            continue;
          let result;
          try {
            result = await request("/api/jobs/" + job.id);
          } catch {
            continue;
          }
          if (stopped) return;
          if (result.state === "READY") {
            await update(item.id, (current) =>
              current.job?.id === job.id
                ? {
                    ...current,
                    job: undefined,
                    story: {
                      real: true,
                      ready: true,
                      jobId: job.id,
                      pages: result.pages,
                      sourceImage: result.sourceImage,
                      words: result.words,
                      setting: result.setting,
                      delivered: Date.now(),
                      position: 0,
                      variants: {},
                      previous: {},
                      adjustments: 0,
                    },
                  }
                : current,
            );
            notify("故事准备好了，先看看，再一起读。");
          } else if (
            result.state !== job.state ||
            result.stage !== job.stage ||
            result.error !== job.error
          ) {
            await update(item.id, (current) =>
              current.job?.id === job.id
                ? { ...current, job: { ...current.job, ...result } }
                : current,
            );
          }
        }
      } catch (error) {
        if (!stopped) notify(error.message || "同步画册失败，请稍后重试。");
      } finally {
        if (!stopped) timer = setTimeout(poll, 2000);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [ready, request, update, publish, notify]);
  return {
    items,
    ready,
    error,
    config,
    request,
    update,
    refreshConfig,
    retry: () => setAttempt((n) => n + 1),
  };
}
