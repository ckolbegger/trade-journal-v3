// The versioned release worker lands with its cache and control check in T18.
// This entry installs cleanly, never takes control from a running release, and names the
// Offline Release Inventory it will validate.
const RELEASE_INVENTORY_URL = "/release-inventory.json";
self.releaseInventoryUrl = RELEASE_INVENTORY_URL;

self.addEventListener("install", () => {});
