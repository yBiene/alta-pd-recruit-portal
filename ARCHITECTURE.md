# MRPD portal source layout

`app.js` is now the 818-line application core. Existing Academy version adapters are isolated in `legacy-academy.js`; they are preserved to avoid changing saved records and established workflows during this release. They remain a future consolidation task.

The browser loads `portal-core.js`, generated in the original execution order. Do not edit that generated file directly. After changing any source listed below, run:

```sh
node scripts/build-portal.mjs
node --check portal-core.js
node tests/account-edit.cjs
```

| Source | Responsibility |
| --- | --- |
| app.js | Authentication, basic data mapping and original core views |
| legacy-academy.js | Existing Academy adapters and navigation compatibility |
| academy-workflow.js | Academy workflow and searchable messages |
| quiz-engine.js | Question flow and answer feedback |
| mail-attachments.js | Private message attachments |
| cad-simulator.js | Local CAD training simulator |
| department-hub.js | Department routing and integration hooks |
| department-tree.js | Editable organization hierarchy and assignments |
| account-admin.js | Accountinformation editor and status indicators |
| chat-members.js | Channel rosters, public profiles and online status |
| calendar-reminders.js | Persistent reminder inbox and optional desktop alerts |
| workspace-layout.js | Channel shortcuts and viewport chat layout |
| zellenbereich.js | Evidence records and reversible image deletion |

Backend permissions are enforced in Supabase, not by button visibility. Account edits use the `manage-user` Edge Function with an explicit field whitelist. Department writes keep the existing Ausbilder+ RLS policy. A trigger rejects hierarchy cycles. Image removal increments the record version and writes an audit entry; original storage objects are retained for restoration.

The `mrpd-pd-calendar-reminders` database job runs once per minute and creates user-scoped reminder rows at 60 and 30 minutes before PD events. A unique key prevents duplicates; reminders for an old start time are hidden after rescheduling. Portal notifications remain available after closing the page. Desktop notifications require an open portal and browser permission; background Web Push is not configured.

Database regression checks are in `database/workspace_upgrade.tests.sql`. They create fixtures within a transaction and roll them back. The `tests/account-edit.cjs` test mocks external Auth/database calls and checks permissions, allowed fields, validation and rollback.
