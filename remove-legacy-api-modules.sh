#!/bin/sh
set -eu

rm -f \
  api/lib/auth.js \
  api/lib/config.js \
  api/lib/db.js \
  api/lib/errors.js \
  api/lib/validation.js \
  api/routes/admin.js \
  api/routes/campaigns.js \
  api/routes/wallet.js

rmdir api/lib api/routes 2>/dev/null || true
