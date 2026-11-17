import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  try {
    // ============================================================
    // SUPABASE
    // ============================================================
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) {
      throw new Error("Supabase Server-Konfiguration fehlt");
    }
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      throw new Error("Authorization Header fehlt");
    }
    const caller = createClient(url, anon, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const admin = createClient(url, service, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    // ============================================================
    // ANGEMELDETEN BENUTZER PRÜFEN
    // ============================================================
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser();
    if (userErr) {
      throw new Error(
        "Anmeldung konnte nicht geprüft werden: " + userErr.message
      );
    }
    if (!user) {
      throw new Error("Nicht angemeldet");
    }
    const { data: me, error: meError } = await admin
      .from("profiles")
      .select("id,username,role,access_level,account_enabled,archived_at,status")
      .eq("id", user.id)
      .maybeSingle();
    if (meError) {
      throw new Error(
        "Profil-Abfrage fehlgeschlagen: " + meError.message
      );
    }
    if (!me) {
      throw new Error("Profil fehlt für UID: " + user.id);
    }
    if(me.account_enabled===false||me.archived_at||me.status==='Archiviert')throw new Error('Account nicht aktiv');
    const body = await req.json();
    const action = String(body.action || "");
    const owner =
      me.role === "admin" &&
      me.access_level === "owner";
    // ============================================================
    // GÜLTIGE AUSBILDER-RÄNGE
    // ============================================================
    const allowedTrainerRanks = ['Rekrut','Police Officer','Police Officer 2','Detective','Sergeant','Lieutenant','Captain 1','Captain 2','Deputy Chief','Assistant Chief','Chief of Police'];
    // ============================================================
    // ACCOUNT ERSTELLEN
    // ============================================================
    if (action === "create") {
      const role =
        body.role === "trainer"
          ? "trainer"
          : "recruit";
      const mayCreateRecruit =
        owner ||
        (
          me.role === "trainer"
        );
      const mayCreateTrainer = owner || (me.role === "trainer" && me.access_level === "extra");
      if (
        role === "recruit" &&
        !mayCreateRecruit
      ) {
        throw new Error(
          "Keine Berechtigung zum Erstellen von Recruit-Accounts"
        );
      }
      if (
        role === "trainer" &&
        !mayCreateTrainer
      ) {
        throw new Error(
          "Nur Ausbilder + dürfen Ausbilder-Accounts erstellen"
        );
      }
      // ----------------------------------------------------------
      // Benutzername
      // ----------------------------------------------------------
      const username = String(
        body.username || ""
      )
        .trim()
        .toLowerCase();
      if (
        !/^[a-z0-9._-]{3,40}$/.test(username)
      ) {
        throw new Error(
          "Ungültiger Benutzername"
        );
      }
      const email =
        `${username}@altapd.internal`;
      // ----------------------------------------------------------
      // Prüfen ob Benutzername bereits existiert
      // ----------------------------------------------------------
      const {
        data: existingProfile,
        error: existingProfileError,
      } = await admin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existingProfileError) {
        throw new Error(
          "Benutzerprüfung fehlgeschlagen: " +
            existingProfileError.message
        );
      }
      if (existingProfile) {
        throw new Error(
          "Dieser Benutzername ist bereits vergeben"
        );
      }
      // ----------------------------------------------------------
      // Rang prüfen
      // ----------------------------------------------------------
      const officerAccount=body.accountType==='officer';
      if(officerAccount&&!mayCreateRecruit)throw new Error('Keine Berechtigung zum Erstellen von Officer-Accounts');
      const rank = role==='recruit'&&!officerAccount?'Rekrut':String(body.rank||(officerAccount?'Police Officer':'Sergeant')).trim();
      if(officerAccount&&allowedTrainerRanks.indexOf(rank)>=4&&!mayCreateTrainer)throw new Error('Accounts ab Sergeant können nur Ausbilder + erstellen');
      if(officerAccount&&rank==='Rekrut')throw new Error('Bitte einen Officer-Dienstgrad auswählen');
      if(!allowedTrainerRanks.includes(rank))throw new Error('Ungültiger Dienstgrad');
      const temporaryPassword="123456";

      // ----------------------------------------------------------
      // Auth Account erstellen
      // ----------------------------------------------------------
      const {
        data: created,
        error: createErr,
      } =
        await admin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            username,
            name: String(
              body.name || username
            ),
          },
        });
      if (createErr) {
        throw new Error(
          "Auth-Account konnte nicht erstellt werden: " +
            createErr.message
        );
      }
      if (!created.user) {
        throw new Error(
          "Supabase hat keinen Benutzer zurückgegeben"
        );
      }
      // ----------------------------------------------------------
      // Ausbildungsbeginn
      // ----------------------------------------------------------
      const startRaw = String(
        body.start || ""
      ).trim();
      let start = "";
      const germanDate =
        startRaw.match(
          /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
        );
      if (germanDate) {
        start =
          `${germanDate[3]}-` +
          `${germanDate[2].padStart(2, "0")}-` +
          `${germanDate[1].padStart(2, "0")}`;
      } else if (
        /^\d{4}-\d{2}-\d{2}$/.test(
          startRaw
        )
      ) {
        start = startRaw;
      }
      // ----------------------------------------------------------
      // Zugriff
      // ----------------------------------------------------------
      const accessLevel =
        role === "trainer"
          ? (
              body.access === "extra"
                ? "extra"
                : "standard"
            )
          : "standard";
      const status = officerAccount ? "Officer" :
        role === "recruit"
          ? "In Ausbildung"
          : (
              accessLevel === "extra"
                ? "Ausbilder +"
                : "Ausbilder"
            );
      // ----------------------------------------------------------
      // Profil erstellen
      // ----------------------------------------------------------
      const { error: profileErr } =
        await admin
          .from("profiles")
          .insert({
            id: created.user.id,
            username,
            name: String(
              body.name || username
            ).trim(),
            service_no: String(
              body.serviceNo || ""
            ).trim(),
            rank,
            role,
            access_level: accessLevel,
            status,
            fto: String(
              body.fto || ""
            ).trim(),
            training_start: start || null,
            must_change_password: true,
            initial_password_is_default: true,
          });
      if (profileErr) {
        // Auth Account wieder entfernen,
        // falls das Profil nicht angelegt werden konnte.
        await admin.auth.admin.deleteUser(
          created.user.id
        );
        throw new Error(
          "Portal-Profil konnte nicht erstellt werden: " +
            profileErr.message
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          id: created.user.id,
          username,
          role,
          rank,
          temporaryPassword,
        }),
        {
          status: 200,
          headers: cors,
        }
      );
    }
    // ============================================================
    // PASSWORT AUF 123456 ZURÜCKSETZEN
    // ============================================================
    if (action === "reset_password") {
      if (!owner) {
        throw new Error(
          "Nur der Hauptadmin darf Passwörter zurücksetzen"
        );
      }
      const userId = String(
        body.userId || ""
      );
      if (!userId) {
        throw new Error(
          "Benutzer-ID fehlt"
        );
      }
      if (userId === user.id) {
        throw new Error(
          "Dein eigenes Passwort änderst du unter Mein Konto"
        );
      }
      const {
        data: target,
        error: targetError,
      } = await admin
        .from("profiles")
        .select(
          "id,role,access_level"
        )
        .eq("id", userId)
        .maybeSingle();
      if (targetError) {
        throw new Error(
          "Account konnte nicht geladen werden: " +
            targetError.message
        );
      }
      if (!target) {
        throw new Error(
          "Account nicht gefunden"
        );
      }
      if (
        target.access_level === "owner"
      ) {
        throw new Error(
          "Das Hauptadmin-Passwort wird hier nicht zurückgesetzt"
        );
      }
      const {
        error: authError,
      } =
        await admin.auth.admin.updateUserById(
          userId,
          {
            password: "123456",
          }
        );
      if (authError) {
        throw new Error(
          "Passwort konnte nicht zurückgesetzt werden: " +
            authError.message
        );
      }
      const {
        error: flagError,
      } = await admin
        .from("profiles")
        .update({
          must_change_password: true,
            initial_password_is_default: true,
        })
        .eq("id", userId);
      if (flagError) {
        throw new Error(
          "Passwortstatus konnte nicht gesetzt werden: " +
            flagError.message
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
        }),
        {
          status: 200,
          headers: cors,
        }
      );
    }
    // ============================================================
    // AUSBILDER-RANG ÄNDERN
    // ============================================================
    if (action === "trainer_rank" || action === "rank_change") {
      const {data,error}=await caller.rpc('portal_hub_rpc',{p_action:'rank',p_args:{user_id:String(body.userId||''),rank:String(body.rank||''),reason:String(body.reason||'Dienstgradanpassung über Account-Verwaltung')}});
      if(error)throw error;
      return new Response(JSON.stringify(data),{status:200,headers:cors});
    }
    if (action === "trainer_access") {
      if (!owner) {
        throw new Error(
          "Nur der Hauptadmin darf Ausbilderrechte ändern"
        );
      }
      const userId = String(
        body.userId || ""
      );
      if (!userId) {
        throw new Error(
          "Benutzer-ID fehlt"
        );
      }
      const {
        data: targetTrainer,
        error: targetTrainerError,
      } = await admin
        .from("profiles")
        .select(
          "id,role,access_level"
        )
        .eq("id", userId)
        .maybeSingle();
      if (targetTrainerError) {
        throw new Error(
          "Ausbilder konnte nicht geladen werden: " +
            targetTrainerError.message
        );
      }
      if (!targetTrainer) {
        throw new Error(
          "Ausbilder nicht gefunden"
        );
      }
      if (
        targetTrainer.access_level ===
        "owner"
      ) {
        throw new Error(
          "Die Rechte des Hauptadmins können hier nicht geändert werden"
        );
      }
      if (
        targetTrainer.role !== "trainer"
      ) {
        throw new Error(
          "Der ausgewählte Account ist kein Ausbilder"
        );
      }
      const access =
        body.access === "extra"
          ? "extra"
          : "standard";
      const status =
        access === "extra"
          ? "Ausbilder +"
          : "Ausbilder";
      const { error } = await admin
        .from("profiles")
        .update({
          access_level: access,
          status,
        })
        .eq("id", userId)
        .eq("role", "trainer");
      if (error) {
        throw new Error(
          "Ausbilderrechte konnten nicht geändert werden: " +
            error.message
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          access,
        }),
        {
          status: 200,
          headers: cors,
        }
      );
    }
    // ============================================================
    // ACCOUNT LÖSCHEN
    // ============================================================
    if (action === "delete") {
      const userId = String(
        body.userId || ""
      );
      if (!userId) {
        throw new Error(
          "Benutzer-ID fehlt"
        );
      }
      if (userId === user.id) {
        throw new Error(
          "Du kannst deinen eigenen Account hier nicht löschen"
        );
      }
      const {
        data: target,
        error: targetError,
      } = await admin
        .from("profiles")
        .select(
          "id,username,role,access_level"
        )
        .eq("id", userId)
        .maybeSingle();
      if (targetError) {
        throw new Error(
          "Account konnte nicht geladen werden: " +
            targetError.message
        );
      }
      if (!target) {
        throw new Error(
          "Account nicht gefunden"
        );
      }
      if (
        target.access_level === "owner"
      ) {
        throw new Error(
          "Der Hauptadmin kann nicht gelöscht werden"
        );
      }
      const mayDelete = owner;
      // ENDGÜLTIGES LÖSCHEN:
      // Ausschließlich der Hauptadmin (admin + owner) darf Accounts löschen.
      if (!mayDelete) {
        throw new Error(
          "Nur der Hauptadmin darf Accounts endgültig löschen"
        );
      }
      /*
       * WICHTIG:
       *
       * Wir löschen hier weiterhin NICHT blind alle Academy-Daten.
       * Deine Datenbank besitzt viele Foreign-Key-Verknüpfungen.
       *
       * Wenn der Benutzer noch referenziert wird, soll Supabase
       * die Löschung blockieren, statt Ausbildungsdaten unbemerkt
       * zu zerstören.
       */
      const {
        error: profileDeleteError,
      } = await admin
        .from("profiles")
        .delete()
        .eq("id", userId);
      if (profileDeleteError) {
        throw new Error(
          "Portal-Profil kann noch nicht gelöscht werden. " +
          "Der Account wird noch von Ausbildungs- oder Academy-Daten verwendet. " +
          profileDeleteError.message
        );
      }
      const {
        error: deleteAuthError,
      } =
        await admin.auth.admin.deleteUser(
          userId
        );
      if (deleteAuthError) {
        throw new Error(
          "Portal-Profil wurde entfernt, aber der Auth-Account konnte nicht gelöscht werden: " +
            deleteAuthError.message
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          deleted: userId,
        }),
        {
          status: 200,
          headers: cors,
        }
      );
    }
    // ============================================================
    // UNBEKANNTE AKTION
    // ============================================================
    throw new Error(
      "Unbekannte Aktion: " + action
    );
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Unbekannter Fehler";
    console.error(
      "[manage-user]",
      message
    );
    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods":
            "POST, OPTIONS",
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});
