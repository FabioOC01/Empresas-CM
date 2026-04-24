import { useAuth } from '../context/AuthContext';

const ROLES_VE_TODO = ['Admin', 'Gerencia'];

/**
 * Devuelve el vendedor_id que se debe usar como filtro obligatorio.
 * - Admin, Gerencia, Superadmin → null  (ven todo)
 * - Cualquier otro rol           → user.id (solo ven lo propio)
 */
export default function useRolFilter() {
    const { user } = useAuth();
    if (!user) return null;
    if (user.is_superadmin) return null;
    const puedeVerTodo = user.roles?.some(r => ROLES_VE_TODO.includes(r));
    return puedeVerTodo ? null : user.id;
}
