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

## Emergency communications workspace

Open **Readiness** from the workspace navigation, or select **Start preparation**
from Home. Start with your iPhone, then repeat the steps on your wife's iPhone.
Preparation opens one instruction at a time. Each radio has a separate backup,
rollback and non-destructive bootloader assignment. Use Device Backups to
record the actual installed version and hardware revision before attaching files.

- **Firmware Vault** stores metadata and, when attached, a browser-local copy up
  to 32 MiB per file. SHA-256 uses Web Crypto. A matching reference digest is
  distinct from an operator's hardware pass. A locally baselined digest checks
  later integrity. Keep the originals on the preparedness SSD.
- **Offline Archive** tracks laptop, external drive, both phones, and print
  copies. Download the audited starter ZIPs from Preparation task 3. They contain
  scripts and manifests. Exact rollback files depend on the installed radios.
- **Migration** unlocks controlled flashing steps after Offline Ready and an
  explicit bench preflight. Print the quick reference and beginner walkthrough
  for the external archive. Use the native applications and Windows tools for
  any radio operation.
- **Field Log** records either protocol, its observation provenance, antenna
  configuration, internet and MQTT status, and distinct route evidence.
  Coverage Map filters local points by protocol and measurement class. RF
  Analytics compares observations recorded under a shared session, stop and
  path class. Captured and theoretical evidence have distinct handling.
- **Data & help** backs up and restores version-2 JSON project data, and can
  still import version-1 backups. Firmware attachments are deliberately stored
  separately and must be reattached after a restore. Field locations, screenshots
  and notes can be personal. Keep their exports under your control. Record only
  non-secret metadata in the PWA. Save YAML, channel QR codes, key material and
  credentials to separate protected storage.

Readiness maturity is gated sequentially. Independent app, package, recovery,
offline and validation evidence must be current. A skipped, blocked, expired,
or mismatched prerequisite cannot unlock a higher level. Preparation and
operational route evidence are displayed separately. There is no automatic
radio data collection. Treat the local coordinate map as a plot of observations
and imported reference geometry.

### Install and verify on iPhone

1. Open the [live application](https://ckeysvt88.github.io/meshtesting-/) in Safari.
2. Tap Share → Add to Home Screen and launch the installed app while online.
3. Open Data & help and confirm the offline cache is active. On an existing
   installation, close old app tabs and relaunch to activate the new worker.
4. Turn on Airplane Mode, turn Wi-Fi off, then reopen the PWA. Check that the
   preparation instructions, local records, checked firmware attachments,
   map points and export controls are available.
5. Keep a JSON export, downloaded files and paper copy outside browser storage.
   Clearing browser data or iOS eviction can remove cached artifacts.

### Deployment and recovery

GitHub Actions runs the Node and Chromium suites, publishes GitHub Pages on
`main`, then verifies the live HTTPS origin and Chrome PWA installation.
The pre-expansion snapshot is branch `rollback/pre-emergency-readiness` at
`45dd9405f2f89ae6e31eafa3131309185b384b2d`. IndexedDB adds stores in version 2.
If deploying older app code for a rollback, update that code to open the
existing database version without downgrading it, or use a separate browser
profile for the old app. Save an external project export before any recovery.
