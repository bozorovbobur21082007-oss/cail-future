# Project architecture
- Keep warehouse layout and slot mapping in a pure TypeScript module shared by 3D views; rendering must not invent stock or duplicate unplaced products across shelves.
- Use one shared warehouse viewer in admin and worker maps; reuse fetched records and existing shelf detail actions without changing permissions.