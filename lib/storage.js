import { seed } from "./stories.js";

// Keep the v1 database and keys so an upgrade at the same origin preserves all
// artwork, unfinished jobs and the credential used to retrieve them.
export function openDatabase() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(
      () => fail(new Error("读取本机画册超时，请关闭其他同站页面后重试。")),
      12000,
    );
    let request;
    try {
      request = indexedDB.open("huahuole-demo", 1);
    } catch (error) {
      fail(error);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("data"))
        request.result.createObjectStore("data");
    };
    request.onblocked = () =>
      fail(new Error("画册被其他页面占用，请关闭其他同站页面后重试。"));
    request.onerror = () =>
      fail(request.error || new Error("当前浏览器无法打开本机画册。"));
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function transact(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("data", mode);
    let value;
    const timer = setTimeout(() => {
      try {
        tx.abort();
      } catch {}
      reject(new Error("读取或保存本机记录超时，请重试。"));
    }, 12000);
    const fail = (error) => {
      clearTimeout(timer);
      reject(error || new Error("记录保存中断"));
    };
    tx.oncomplete = () => {
      clearTimeout(timer);
      resolve(value);
    };
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error);
    try {
      work(tx.objectStore("data"), (result) => {
        value = result;
      });
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      fail(error);
    }
  });
}

export async function initializeLibrary(db) {
  return transact(db, "readwrite", (store, result) => {
    const artworks = store.get("artworks"),
      credential = store.get("client-token");
    let items, token;
    const done = () => {
      if (items && token) result({ items, token });
    };
    artworks.onsuccess = () => {
      items = artworks.result ?? seed();
      if (!artworks.result) store.put(items, "artworks");
      done();
    };
    credential.onsuccess = () => {
      token = credential.result;
      if (!token) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join("");
        store.put(token, "client-token");
      }
      done();
    };
  });
}

export function readLibrary(db) {
  return transact(db, "readonly", (store, result) => {
    const request = store.get("artworks");
    request.onsuccess = () => result(request.result || []);
  });
}

// Every update reads the latest committed collection in the same transaction.
// One tab cannot overwrite unrelated changes saved by another tab.
export function updateArtwork(db, id, change, { create = false } = {}) {
  return transact(db, "readwrite", (store, result) => {
    const request = store.get("artworks");
    request.onsuccess = () => {
      const items = request.result || [],
        index = items.findIndex((item) => item.id === id);
      if (index < 0 && !create) {
        result(items);
        return;
      }
      let updated;
      try {
        updated = change(index < 0 ? null : items[index]);
      } catch (error) {
        store.transaction.abort();
        return;
      }
      if (updated === null) {
        if (index >= 0) items.splice(index, 1);
      } else if (index >= 0) items[index] = updated;
      else items.unshift(updated);
      store.put(items, "artworks");
      result(items);
    };
  });
}
