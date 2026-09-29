export async function api(token, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Client-Token": token,
        ...options.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error("服务响应异常，请稍后重试。");
    }
    if (!response.ok)
      throw Object.assign(new Error(data.error || "请求失败"), {
        status: response.status,
      });
    return data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("连接超时，请检查网络；已提交的故事可稍后找回。");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
