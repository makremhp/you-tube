#!/bin/sh
# Run once from the repo root: removes the old module copies from api/
# (they now live in server/). Keeps api/index.js and api/telegram/.
set -eu
rm -f api/admin.js api/auth.js api/campaigns.js api/config.js api/db.js \
      api/errors.js api/membership.js api/router.js api/validation.js api/wallet.js
