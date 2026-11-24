# Mesh Field Lab pre-deployment review

These are three AI review perspectives. Hardware behavior remains subject to direct device verification.

| Perspective | Finding and correction | Verification |
| --- | --- | --- |
| RF engineering | Unknown transmit windows are excluded from packet rates. A single range packet cannot pass a two-way trial. Separate paired human receipts, controlled paths and dated repeats. Relayed RSSI may reflect the last hop. Coverage stays point-based. | Domain tests cover distance, free-space loss, midpoint Fresnel radius, weighted reception and paired trials. |
| Meshtastic technical | BLE permits client proxy. The guide requires per-radio MQTT and channel settings readback. Long Fast uses the documented 30-second starting interval. The X1 receiver uses interval zero. Removed assumed device-side CSV recording for nRF52840 and distinguished position records from RF reception. | Cross-checked official Range Test, MQTT, hardware and traceroute documentation. Actual installed firmware and Apple menus require radio access. |
| Software and UX | Escaped user content, blocked active external assets, validated file formats, added preview and duplicate checks, atomic restoration, a responsive layout and a repository-scoped shell cache. | Browser tests exercise both widths, GPS, timer, database reload, analytics, backup restore, packet import, manifest icons and offline reload. Physical iPhone installation is a separate check. |

The import review also checked [firmware RangeTestModule.cpp](https://github.com/meshtastic/firmware/blob/master/src/modules/RangeTestModule.cpp) and the [Apple CSV writer](https://github.com/meshtastic/Meshtastic-Apple/blob/main/Meshtastic/Export/WriteCsvFile.swift). Regression tests cover split RSSI values and localized Position Log timestamps. A timestamp without a reliable timezone stays in the source notes.

## Emergency readiness and MeshCore expansion

Review date: November 24, 2026. Rollback branch:
`rollback/pre-emergency-readiness` at `45dd9405f2f89ae6e31eafa3131309185b384b2d`.

| Review | Evidence |
| --- | --- |
| Data and migrations | Existing IndexedDB stores are preserved across the version upgrade. Version-1 exports import; new JSON exports omit binary attachments and current attachment hashes. Secret-bearing radio configurations stay in protected user-managed storage. |
| Readiness logic | Unit tests cover missing binaries and erase assets, installed version matching, independent device evidence, skipped and stale prerequisites, and route proof requiring matching protocol in both directions. |
| Existing and new browser workflows | Chromium checks at 390 px and 1440 px exercised guide, navigation, field entry, map, analytics, JSON restore, CSV import and offline reload. The readiness browser case exercised independent phone records, resumed step and evidence, preflight restriction, firmware hash comparison and offline file download. |
| Firmware sourcing | Official v1.18.0 companion and repeater UF2 and OTA ZIP assets were fetched and matched publisher SHA-256 digests. The downloaded Windows desktop archive identifies v1.52.0 in its changelog. The flasher erase image and desktop archive have locally measured hashes only. |
| Starter packages | Both original archives were inspected and both replacements passed ZIP integrity checks. The new helper checks relative paths, expected file headers and per-radio rollback digests. Files are staged by the user with device-specific software and a full offline rehearsal. |
| Hands-on coverage | Automated checks use fixtures. Physical radios, firmware transition and restore, Windows hardware drivers and PowerShell execution, installed iPhone Safari, and the Clayton–Cary route require real-device verification. |

Locally observed SHA-256 values for the manufacturer-linked erase image
and Windows desktop ZIP are respectively
`aceed09aabfdb23e68d2c18577f7654048c2c4c2f947dd7cf00de8cdb4869633`
and `58ca3a1596a81d4a4f4833f3a13ffb40c909dc7ca3a2ec992cb316995e6c833a`.
Use the official publication as the authority for later versions. Wio antenna
bulkhead selection depends on the fitted pigtail. Field performance and VSWR
require measurements.
