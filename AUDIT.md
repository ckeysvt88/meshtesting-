# Mesh Field Lab pre-deployment review

These are three AI review perspectives. Hardware behavior remains subject to direct device verification.

| Perspective | Finding and correction | Verification |
| --- | --- | --- |
| RF engineering | Unknown transmit windows are excluded from packet rates. A single range packet cannot pass a two-way trial. Separate paired human receipts, controlled paths and dated repeats. Relayed RSSI may reflect the last hop. Coverage stays point-based. | Domain tests cover distance, free-space loss, midpoint Fresnel radius, weighted reception and paired trials. |
| Meshtastic technical | BLE permits client proxy. The guide requires per-radio MQTT and channel settings readback. Long Fast uses the documented 30-second starting interval. The X1 receiver uses interval zero. Removed assumed device-side CSV recording for nRF52840 and distinguished position records from RF reception. | Cross-checked official Range Test, MQTT, hardware and traceroute documentation. Actual installed firmware and Apple menus require radio access. |
| Software and UX | Escaped user content, blocked active external assets, validated file formats, added preview and duplicate checks, atomic restoration, a responsive layout and a repository-scoped shell cache. | Browser tests exercise both widths, GPS, timer, database reload, analytics, backup restore, packet import, manifest icons and offline reload. Physical iPhone installation is a separate check. |

The import review also checked [firmware RangeTestModule.cpp](https://github.com/meshtastic/firmware/blob/master/src/modules/RangeTestModule.cpp) and the [Apple CSV writer](https://github.com/meshtastic/Meshtastic-Apple/blob/main/Meshtastic/Export/WriteCsvFile.swift). Regression tests cover split RSSI values and localized Position Log timestamps. A timestamp without a reliable timezone stays in the source notes.
