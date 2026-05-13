import { useAuth } from '../context/AuthContext';
import { canViewAll } from '../utils/roles';

/**
 * Devuelve el vendedor_id que se debe usar como filtro obligatorio.
 * - Admin, Superadmin o Gerencia sin otro rol operativo -> null (ven todo)
 * - Cualquier otro rol, incluyendo Gerencia + otro rol -> user.id
 */
export default function useRolFilter() {
    const { user } = useAuth();
    if (!user) return null;
    return canViewAll(user) ? null : user.id;
}
