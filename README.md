# Mesh Field Lab

Meshtastic field surveys, relay evaluation, and family route validation. The public app runs as a static PWA. Keep exact endpoints, survey data, and screenshots in your own browser workspace.

## First CS01 to X1 Range Test

1. Connect to each radio by name in Meshtastic. Record the exact hardware and firmware. Compare LoRa region, preset, slot, overrides and test channel on both radios. Compare channel keys privately.
2. On CS01 and both X1s, open Settings → Module Configuration → MQTT. Disable MQTT Enabled and Client Proxy. In Settings → Channels, turn off Uplink and Downlink on enabled channels. Read back your changes. For an RF-only trial, also turn off phone Wi-Fi and cellular while leaving Bluetooth enabled. Unknown public paths remain unverified.
3. Exchange fresh direct messages around home. Read the actual text at the recipient and get a reply. Fix a failed baseline before leaving.
4. On X1 #1, go to Settings → Module Configuration → Range Test. Enable, set the sender interval to 0 and leave Save CSV off. On CS01, enable Range Test and set 30 seconds for Long Fast, or 60 seconds for fewer packets. Save, return to X1 #1 and confirm fresh CS01 packets.
5. At each stationary stop, use Field Tests to log start time, optional GPS, fresh packet count, metrics and mounting conditions. Log zero for a miss. Enter sent counts only when verified for the same time window.
6. On CS01, change the interval to 0 and disable Range Test. Disable it on X1 #1 as well. Export a JSON backup. Later, use both X1s for repeated human-confirmed two-way field trials.

## Architecture and verification

Native ES modules, semantic HTML, responsive CSS, IndexedDB transactions, SVG coordinate plotting, and a scoped service worker. No build tooling or server runtime is required for the site. Run `npm test` for domain tests. For browser tests install Playwright, start `npm run serve` and run `npx playwright test tests/browser.spec.cjs --browser chromium`. The local base path is http://127.0.0.1:4321/meshtesting-/.

Pages uses the GitHub Actions publishing source. A passing build on main packages only the static app. Narrow and wide Chromium tests use synthetic locations. In iPhone Safari, use Share → Add to Home Screen and open the installed app once online before a field test.

## Data and limitations

The coordinate plot uses local observations and optional KML, GPX and GeoJSON reference geometry. It has no street tiles or terrain engine. Planning overlays and field observations remain distinct. The CSV importer can map receiver coordinates, packet-level measurements, and position logs. Existing position logs cannot establish packet counts. CSV exports preserve measurements and metadata. Use JSON for a complete backup including photos and settings. Backups contain private data. The app never uploads them automatically. Clearing site data can erase the database. Use a trusted browser profile on the Pages origin.

Native Meshtastic handles Bluetooth and radio logging. Device-side CSV writing is ESP32-specific. The P1 Pro uses nRF52840. Verify the actual model, firmware and menus in the installed Apple app before changing settings. Physical iPhone installation, the user's radio firmware and Clayton–Cary reachability require on-device validation.

## Rollback

The branch `rollback/pre-mesh-field-lab` preserves the original README-only commit. Use a revert commit on main to preserve history. To return to the original unpublished state, unpublish the Pages site in Settings → Pages and revert the implementation commit. Export any local user data before clearing site data. To redeploy a later known-good version, restore its files on main in a new commit and run the workflow again. Increment the service-worker cache version when publishing new shell assets.

## Official references

- [Range Test](https://meshtastic.org/docs/configuration/module/range-test/)
- [MQTT configuration](https://meshtastic.org/docs/configuration/module/mqtt/)
- [Apple client](https://meshtastic.org/docs/software/apple/)
- [Device settings](https://meshtastic.org/docs/configuration/radio/device/)
- [CS01 platform documentation](https://meshtastic.org/docs/hardware/devices/seeed-studio/sensecap/solar-node/)
- [Traceroute](https://meshtastic.org/docs/configuration/module/traceroute/)
- [Three-perspective review](AUDIT.md)
