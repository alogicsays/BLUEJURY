# Marine Regions official reference import

Do not place approximated, generated, or third-party boundary files here.

Download the official `World_EEZ_v12_20231025.zip` (World EEZ v12, 2023-10-25) through the Marine Regions download form. Extract it without modification to:

`data/reference/marine-regions/World_EEZ_v12_20231025/`

The loader requires `eez_v12.shp`, `.dbf`, `.shx`, `.prj`, and `LICENSE_EEZ_v12.txt`; it validates WGS84 CRS, polygon geometry, Marine Regions identifiers, and Indian-sovereignty fields. The installed file passed these checks on 2026-09-20. `eez_boundaries_v12` is a separate line dataset and is not loaded by this juror.
