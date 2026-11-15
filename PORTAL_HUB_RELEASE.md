# Academy und Officer Hub – Freigabeentwurf

Stand: 15. November 2026. Noch nicht in Produktion aktiviert.

## Änderungen
- Getrennte Navigation Academy / Officer, kompaktes Dashboard, archivierte Akten aus aktiven Übersichten und Academy-Zahlen entfernt.
- Rangchronik für alle elf Dienstgrade, Beförderungen und Rückstufungen mit Begründung und Prüfprotokoll; Verwaltung durch Ausbilder +.
- Abteilungen und Mitgliedschaften; Bearbeitung durch Ausbilder +.
- Persistenter Staff-Gruppenchat ab Sergeant mit privaten Bildern, Emojis, individuellen Lesebestätigungen und Echtzeit-Aktualisierung.
- Profilbilder, einstellbarer Benachrichtigungston, persönliche Glockenmeldungen und lesbare/löschbare Benachrichtigungen.
- 30 langfristige Abzeichen mit Aktivitätstagen, Streaks, Akten und Ausbildungsarbeit; gesperrte und geheime Ziele im Konto.
- Privater digitaler PD-Kalender für Ausbilder, anonyme Wünsche und Rückmeldungen mit Ausbilder-Posteingang.
- Account-Filter korrigiert; Ausbilder erstellen Rekruten, Ausbilder + zusätzlich Ausbilder-Accounts. Dienstgrad und Systemberechtigung bleiben getrennt.
- Fehlendes UPDATE-Recht für eigene Dokument-Lesebestätigungen behoben.

## Prüfung
JavaScript-Syntax und Whitespace-Prüfungen bestanden. Datenbankmigration und Rollen-/Datenschutztests liefen in einer Transaktion mit abschließendem ROLLBACK: Rekrut, Ausbilder, Ausbilder +, Ranggrenzen, anonyme Rückmeldungen, privater Kalender, fremde Lesebestätigungen, Zeitstempel und Abzeichenintegrität geprüft. Keine Testkonten oder Testdaten blieben bestehen.

Browserprüfung mit lokalen Beispieldaten: kompakte Academy-Ansicht, Bereichswechsel, Staff-Chat mit Nachricht und Emoji, 30 Abzeichen, Account-Filter und Rollenoptionen sowie digitaler Kalender. Echtzeit und Datei-Uploads sind nach Produktionsaktivierung zusätzlich mit echten Sitzungen zu prüfen.

## Aktivierung nach ausdrücklicher Freigabe
1. `database/portal_hub.sql` als Supabase-Migration anwenden.
2. `functions/manage-user.ts` als bestehende Edge Function `manage-user` deployen (verify_jwt=false beibehalten; Authentifizierung erfolgt im Handler).
3. Frontend-Änderungen auf main übernehmen und GitHub-Pages-Veröffentlichung prüfen.
4. Mit echten berechtigten Sitzungen Chat, Bild-Upload, Profilbild, Lesebestätigung und Kalender prüfen.

Die automatische Freigabeprüfung blockierte die dauerhafte Migration wegen ihres Umfangs (neue Tabellen, RLS/Berechtigungen, Storage und Realtime). Deshalb bleiben Datenbank, Edge Function und Live-Website bis zur ausdrücklichen Freigabe unverändert. Die SQL-Testdatei endet absichtlich mit ROLLBACK und darf nicht als Produktionsmigration verwendet werden.
