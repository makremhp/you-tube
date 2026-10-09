export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function ok(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}

export function fail(res, status, error) {
  res.status(status).json({ success: false, error });
}
