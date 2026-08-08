/**
 * Credenciales del panel de gestión (Aura Signature). Protegen los
 * endpoints admin de productos e inventario con HTTP Basic Auth.
 */
export const adminConfig = {
  get user(): string {
    return process.env.ADMIN_USER ?? '';
  },
  get password(): string {
    return process.env.ADMIN_PASSWORD ?? '';
  },
};
