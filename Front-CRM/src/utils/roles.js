export const ROLE_GERENCIA = 'Gerencia';
export const ROLE_ADMIN = 'Admin';

export function getRoles(entity) {
    return Array.isArray(entity?.roles) ? entity.roles : [];
}

export function getEffectiveRoles(entity) {
    const roles = getRoles(entity);
    const operationalRoles = roles.filter((role) => role !== ROLE_GERENCIA);
    return operationalRoles.length ? operationalRoles : roles;
}

export function getDisplayRoles(entity) {
    const roles = getRoles(entity);
    const businessRoles = roles.filter((role) => role !== ROLE_GERENCIA && role !== ROLE_ADMIN);
    if (businessRoles.length) return businessRoles;
    if (roles.includes(ROLE_ADMIN)) return [ROLE_ADMIN];
    return [];
}

export function hasEffectiveRole(entity, role) {
    return getEffectiveRoles(entity).includes(role);
}

export function isAdminUser(user) {
    return !!user?.is_superadmin || getRoles(user).includes(ROLE_ADMIN);
}

export function isGerenciaOnly(user) {
    const roles = getEffectiveRoles(user);
    return !user?.is_superadmin && roles.length === 1 && roles[0] === ROLE_GERENCIA;
}

export function canViewAll(user) {
    return isAdminUser(user) || isGerenciaOnly(user);
}
