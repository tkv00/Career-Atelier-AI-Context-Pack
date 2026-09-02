#!/bin/zsh
set -e
cd -- "${0:A:h}"
if [[ ! -d node_modules ]]; then
  npm install
fi
( sleep 2; open http://localhost:3000 ) &
npm run dev
