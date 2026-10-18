export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

export function ok(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}

// `code` اختياري ومتوافق مع الخلف: يُضاف فقط عند وجوده (مثل VPN_DETECTED) ليميّز الواجهة بين الأخطاء.
export function fail(res, status, error, code) {
  res.status(status).json(code ? { success: false, error, code } : { success: false, error });
}
