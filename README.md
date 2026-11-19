# MRPD Mitarbeiter- und Academy-Portal

Live unter https://ybiene.github.io/alta-pd-recruit-portal/.

Die Website verwendet Supabase für Anmeldung, gemeinsame Daten und private Dateien. Dienst- und Fahrzeugdaten werden im Portal manuell erfasst. Eine Verbindung zu FiveM oder dem RP-Server besteht nicht.

## Dienstbetrieb und Units

„Personal & Dienstbetrieb“ bündelt Abwesenheiten, Bewerbungen, Unit-Wechsel, Beförderungsvorschläge, Beschwerden, Dienstzeiten, Fuhrpark, Ausrüstung und Vorgänge. Derselbe Bereich ist im Reiter „Dienstbetrieb“ jeder Unit mit deren Vorgängen erreichbar. K9 und Air Support haben eigene Units; Qualifikationen werden unter „Training“ verwaltet.

Alle Schreibzugriffe der neuen Verwaltung laufen über `mrpd_ops_command`. Inventarfreigaben werden pro Gegenstand gesperrt; aktive Ausgaben, Dienstzeiten und Rufnamen haben zusätzlich eindeutige Datenbankindizes. Eingereichte Angaben werden für Änderungen zur Nacharbeit zurückgegeben. Unit-Leitungen empfehlen Bewerbungen, Wechsel und Beförderungen; die Portalverwaltung übernimmt die endgültige Entscheidung ausdrücklich. Interne Beschwerden und Disziplinarvorgänge sind gesondert geschützt. Private Anhänge folgen den Rechten ihres Dokuments, Vorgangs oder ihrer Nachricht.

Accounttyp, Dienstgrad und Unit-Funktion sind getrennt. Portalverwaltung und Hauptadministrator haben Verwaltungsrechte; Unit-Leitungen verwalten ihre Unit. Die Zuweisung erfolgt über „Units & Funktionen“.

## Bodycam-Bilder

`bodycam-frames.js` erzeugt einen schwarzen MRPD-Rahmen für Vorschau, Großansicht, JPEG-Download und Druck. Beim Upload werden der authentifizierte Name, Dienstgrad, Dienstnummer und der serverseitige Upload-Zeitpunkt gespeichert. Eine optional angegebene Aufnahmezeit wird als manuell gekennzeichnet. Bei alten Bildern werden ausschließlich tatsächlich gespeicherte Angaben gezeigt. Originaldatei und SHA-256 bleiben erhalten.

## Quellen und Datenbank

`portal-core.js` wird mit `node scripts/build-portal.mjs` aus den bestehenden Kernmodulen erzeugt. Neue Verwaltungsfunktionen liegen in `department-operations.js`, private Anhänge in `portal-files.js`; die Unit-Oberfläche liegt in `unit-workspaces.js`.

Auf einer bereits eingerichteten Datenbank werden die Erweiterungen in dieser Reihenfolge angewendet

1. `database/bodycam_frames.sql`
2. `database/department_operations.sql`
3. `database/portal_files.sql`
4. `database/department_operations_integrity.sql`
5. `database/department_operations_workflow.sql`
6. `database/department_operations_final.sql`
7. `database/department_operations_qualifications.sql`

Die Migrationen wurden für das bestehende Projekt ausgeführt. Qualifikationserinnerungen werden stündlich durch `mrpd-ops-reminders` erstellt; Rückmeldungen zu Freigaben erscheinen in der Portal-Glocke. Automatische Discord-Rollen oder Nachrichten benötigen eine gesonderte Bot-Anbindung.

## Prüfung

`node tests/account-types.cjs` und `node tests/account-edit.cjs` prüfen die Account-API mit Test-Doubles. `database/department_operations.tests.sql` und `database/bodycam_frames.tests.sql` prüfen die echten Datenbankfunktionen und Rechte in einer zurückgerollten Transaktion.

`tests/browser-operations.cjs` verwendet Playwright und `@sparticuz/chromium`. Optional können `PLAYWRIGHT_MODULE` und `CHROMIUM_MODULE` auf installierte Module zeigen. Der Test prüft Formulare, die echte Unit-Einbindung, Freigaben, Upload-Oberfläche, mobile Breite sowie Canvas-Bilder, JPEG-Download und Akten-Druck mit API-Test-Doubles. Er ändert keine produktiven Datensätze.
