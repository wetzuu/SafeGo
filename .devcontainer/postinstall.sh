#!/usr/bin/env bash
set -euo pipefail

if ! command -v agy &> /dev/null; then
  echo "Installing Antigravity CLI (agy)..."
  curl -fsSL https://antigravity.google/cli/install.sh | bash
fi

echo "Installing Node.js dependencies..."
npm install

echo "Compiling Java backend dependencies..."
(cd server/demo && ./gradlew --no-daemon classes testClasses)

echo "Postinstall setup complete."
