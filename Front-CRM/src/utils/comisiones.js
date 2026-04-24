export const COMISION_BASE = 'utilidad';
export const MARGEN_BASE = 2;
export const MARGEN_BAJO = 15;
export const MARGEN_ALTO = 20;
export const PCT_BASE = 0.02;
export const PCT_BAJO = 0.07;
export const PCT_ALTO = 0.08;

export function calcComision(
    facturacion,
    costo,
    cuota,
    pctBase = PCT_BASE,
    pctBajo = PCT_BAJO,
    pctAlto = PCT_ALTO,
    base = COMISION_BASE
) {
    const utilidad = facturacion - costo;
    const margen_pct = facturacion > 0 ? (utilidad / facturacion) * 100 : 0;
    const util_minima = cuota * (MARGEN_BASE / 100);
    const diferencia = utilidad - util_minima;

    let estado = 'sin_margen';
    let pct_comision = 0;
    let mensaje = '';

    if (utilidad < 0) {
        estado = 'perdida';
        mensaje = 'Trabajo con perdida, no aplica comision';
    } else if (facturacion < cuota) {
        estado = 'no_cuota';
        mensaje = 'Sin comision por no alcanzar la cuota de facturacion';
    } else if (margen_pct < MARGEN_BASE) {
        estado = 'sin_margen';
        mensaje = `Sin comision por no alcanzar el ${MARGEN_BASE}% de margen`;
    } else if (margen_pct < MARGEN_BAJO) {
        estado = 'cumple_2';
        pct_comision = pctBase;
        mensaje = `Comision del ${(pctBase * 100).toFixed(0)}% por margen entre ${MARGEN_BASE}% y ${MARGEN_BAJO - 1}%`;
    } else if (margen_pct < MARGEN_ALTO) {
        estado = 'cumple_7';
        pct_comision = pctBajo;
        mensaje = `Comision del ${(pctBajo * 100).toFixed(0)}% por margen desde ${MARGEN_BAJO}%`;
    } else {
        estado = 'cumple_8';
        pct_comision = pctAlto;
        mensaje = `Comision del ${(pctAlto * 100).toFixed(0)}% por margen desde ${MARGEN_ALTO}%`;
    }

    const base_valor = base === 'facturacion' ? facturacion : Math.max(0, utilidad);
    const monto_comision = base_valor * pct_comision;

    return {
        utilidad,
        margen_pct,
        util_minima,
        diferencia,
        estado,
        pct_comision,
        monto_comision,
        mensaje,
        base_valor,
    };
}

export const ESTADO_LABEL = {
    perdida: 'Trabajo con perdida',
    no_cuota: 'No cumple cuota',
    sin_margen: 'Cumple cuota pero no margen',
    cumple_2: 'Comision base',
    cumple_7: 'Comision media',
    cumple_8: 'Comision alta',
};

export const ESTADO_COLOR = {
    perdida: '#e74c3c',
    no_cuota: '#e67e22',
    sin_margen: '#d4ac0d',
    cumple_2: '#3498db',
    cumple_7: '#27ae60',
    cumple_8: '#1e8449',
};
