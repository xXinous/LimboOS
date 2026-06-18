const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

// Try to find service account file or use default credentials
const serviceAccountPath = './service-account.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Erro: Arquivo service-account.json não encontrado. Por favor, coloque as credenciais do Firebase Admin SDK na raiz do projeto.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const adminEmail = 'gm.mpg@limboos.local';

async function setAdminClaim() {
  try {
    const user = await getAuth().getUserByEmail(adminEmail);
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`Sucesso: Claim 'admin: true' atribuída ao usuário ${adminEmail} (UID: ${user.uid})`);
  } catch (error) {
    console.error('Erro ao atribuir claim:', error);
  }
}

setAdminClaim();
