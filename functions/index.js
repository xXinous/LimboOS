const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const ADMIN_EMAIL = "gm.mpg@runningman.local";

/**
 * adminResetPassword — allows the admin to change any user's password.
 *
 * Callable from the client with:
 *   const fn = httpsCallable(functions, 'adminResetPassword');
 *   await fn({ targetUid, newPassword });
 */
exports.adminResetPassword = onCall(
  { region: "southamerica-east1" },
  async (request) => {
    // 1. Verify caller is authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Autenticação necessária.");
    }

    // 2. Verify caller is the admin
    if (request.auth.token.email !== ADMIN_EMAIL) {
      throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode alterar senhas."
      );
    }

    const { targetUid, newPassword } = request.data;

    if (!targetUid || typeof targetUid !== "string") {
      throw new HttpsError("invalid-argument", "targetUid é obrigatório.");
    }
    if (
      !newPassword ||
      typeof newPassword !== "string" ||
      newPassword.length < 6
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Senha deve ter no mínimo 6 caracteres."
      );
    }

    // 3. Prevent admin from changing their own password via this route
    if (targetUid === request.auth.uid) {
      throw new HttpsError(
        "invalid-argument",
        "Use as configurações do seu perfil para alterar sua própria senha."
      );
    }

    try {
      await getAuth().updateUser(targetUid, { password: newPassword });

      // Log to Firestore for audit trail
      await getFirestore().collection("activityLog").add({
        uid: "admin",
        username: "gm.mpg",
        type: "admin",
        category: "password_reset",
        message: `Senha alterada para UID: ${targetUid.slice(0, 8)}...`,
        metadata: { targetUid },
        timestamp: new Date(),
        source: "admin",
      });

      return { success: true };
    } catch (error) {
      console.error("Error resetting password:", error);
      throw new HttpsError(
        "internal",
        `Falha ao alterar senha: ${error.message}`
      );
    }
  }
);
