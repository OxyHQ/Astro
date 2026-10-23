#!/bin/sh
set -eu
source="$PROJECT_DIR/../../../apps/cli/install.sh"
resources="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
mkdir -p "$resources"
install -m 0644 "$source" "$resources/astro-cli-install.sh"
