/**
 * Datos que aparecen en /privacy y /terms. Revísalos antes de publicar la app:
 * son documentos que Meta y tus clientes van a leer.
 */
export const legalConfig = {
  businessName: process.env.LEGAL_BUSINESS_NAME ?? 'Aura Signature',
  contactEmail: process.env.LEGAL_CONTACT_EMAIL ?? 'psamirt94@hotmail.com',
  lastUpdated: process.env.LEGAL_LAST_UPDATED ?? '25 de julio de 2026',
  retentionMonths: Number(process.env.LEGAL_RETENTION_MONTHS ?? 24),
};
