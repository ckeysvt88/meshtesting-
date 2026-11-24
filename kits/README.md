# Offline starter packages

Both downloadable archives were regenerated from the supplied starters after
inspection. Included are Windows launchers, a shared PowerShell helper,
device-specific manifests, and a rollback manifest example. The bundled
manifest pins MeshCore v1.18.0 X1 Bluetooth companion and SenseCAP Solar
repeater images using the publisher's GitHub release digests. The verified
official links are in each manifest. MeshCore Desktop v1.52.0 and the erase
asset were fetched from their linked distributions and inspected separately.
Their locally calculated SHA-256 values are integrity baselines, not publisher
attestations. The starter archives contain no third-party binaries.

Copy the appropriate template to `rollback.json` after downloading the exact
known-good Meshtastic release for each radio and deciding whether its official
instructions require an erase image. A required digest mismatch blocks new
archive creation. The helper only reads files in the kit and downloads official
assets listed in the manifest. It never accesses a serial port or radio.
