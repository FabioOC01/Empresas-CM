import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { getActividades, updateElapsed, getConfig } from '../api/actividades';
import useSocket from '../hooks/useSocket';

const ActividadesContext = createContext(null);

const HORARIO_DEFAULT = [
    { dia: 1, inicio: '09:30', fin: '18:30' },
    { dia: 2, inicio: '09:30', fin: '18:30' },
    { dia: 3, inicio: '09:30', fin: '18:30' },
    { dia: 4, inicio: '09:30', fin: '18:30' },
    { dia: 5, inicio: '09:30', fin: '18:30' },
];

export const CONFIG_DEFAULT = {
    horario_dias:    HORARIO_DEFAULT,
    tasa_sunat:      0.295,
    tasa_comision:   0.05,
    feriados:        [],
    attendance_config: {
        timezone: 'America/Lima',
        ingreso_esperado: '09:30',
        tolerancia_minutos: 10,
        tardanza_modo: 'primera_entrada',
        sedes: [],
    },
    moneda:          'USD',
    productos_catalogo: [],
    tipos_actividad: ['Venta','Homologación','Visita','Propuesta','Seguimiento','Administrativa','Oportunidad','Cotización','Publicidad','Piezas gráficas','Despacho','Inventario','Facturación','Redes','Soporte'],
    pipeline_etapas: [
        { nombre:'Marketing',   tipos:['Publicidad','Redes','Piezas gráficas'] },
        { nombre:'Prospección', tipos:['Visita','Seguimiento','Oportunidad','Administrativa'] },
        { nombre:'Propuesta',   tipos:['Cotización','Propuesta','Homologación'] },
        { nombre:'Venta',       tipos:['Venta'] },
        { nombre:'Postventa',   tipos:['Despacho','Inventario','Facturación','Soporte'] },
    ],
    rol_tipos: {
        Admin: null, Gerencia: [],
        Marketing: ['Publicidad','Piezas gráficas','Administrativa','Redes'],
        Ventas: ['Venta','Visita','Propuesta','Seguimiento','Oportunidad','Cotización','Administrativa'],
        Corporativo: ['Cotización','Oportunidad','Visita','Homologación'],
        'Soporte Técnico': ['Visita','Cotización','Seguimiento','Soporte'],
        Logística: ['Despacho','Inventario','Facturación'],
        Finanzas: ['Facturación','Administrativa'],
    },
};

function isoDateLima() {
    const lima = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const y = lima.getFullYear();
    const m = String(lima.getMonth() + 1).padStart(2, '0');
    const d = String(lima.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isHorarioLaboral(config) {
    const feriados = config?.feriados || [];
    if (feriados.includes(isoDateLima())) return false;

    const lima  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const dia   = lima.getDay();
    const mins  = lima.getHours() * 60 + lima.getMinutes();
    const dias  = config?.horario_dias || HORARIO_DEFAULT;
    const entry = dias.find(d => d.dia === dia);
    if (!entry) return false;
    const [hI, mI] = entry.inicio.split(':').map(Number);
    const [hF, mF] = entry.fin.split(':').map(Number);
    return mins >= hI * 60 + mI && mins < hF * 60 + mF;
}

export function ActividadesProvider({ children }) {
    const [actividades,   setActividades]   = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [config,        setConfig]        = useState(CONFIG_DEFAULT);
    const [configLoaded,  setConfigLoaded]  = useState(false);
    const socket         = useSocket();
    const actividadesRef = useRef([]);
    const configRef      = useRef(CONFIG_DEFAULT);
    const ticksRef       = useRef(0);

    useEffect(() => { actividadesRef.current = actividades; }, [actividades]);
    useEffect(() => { configRef.current = config; }, [config]);

    useEffect(() => {
        getActividades().then(setActividades).finally(() => setLoading(false));
        getConfig().then(c => { setConfig(c); setConfigLoaded(true); }).catch(() => { setConfigLoaded(true); });
    }, []);

    useEffect(() => {
        const onCreada      = (a)      => setActividades(prev => prev.some(x => x.id === a.id) ? prev.map(x => x.id === a.id ? { ...x, ...a } : x) : [a, ...prev]);
        const onActualizada = (a)      => setActividades(prev => prev.map(x => {
            if (x.id !== a.id) return x;
            if (x.estado === 'En Progreso' && a.estado === 'En Progreso')
                return { ...a, elapsed: Math.max(x.elapsed || 0, a.elapsed || 0) };
            return a;
        }));
        const onEliminada   = ({ id }) => setActividades(prev => prev.filter(x => x.id !== id));

        socket.on('actividad:creada',      onCreada);
        socket.on('actividad:actualizada', onActualizada);
        socket.on('actividad:eliminada',   onEliminada);

        return () => {
            socket.off('actividad:creada',      onCreada);
            socket.off('actividad:actualizada', onActualizada);
            socket.off('actividad:eliminada',   onEliminada);
        };
    }, [socket]);

    useEffect(() => {
        const t = setInterval(() => {
            if (!isHorarioLaboral(configRef.current)) return;
            ticksRef.current++;
            setActividades(prev => prev.map(a =>
                a.estado === 'En Progreso' ? { ...a, elapsed: (a.elapsed || 0) + 1 } : a
            ));
            if (ticksRef.current % 60 === 0) {
                actividadesRef.current
                    .filter(a => a.estado === 'En Progreso')
                    .forEach(a => updateElapsed(a.id, a.elapsed).catch(() => {}));
            }
        }, 1000);
        return () => clearInterval(t);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <ActividadesContext.Provider value={{ actividades, setActividades, loading, config, setConfig, configLoaded }}>
            {children}
        </ActividadesContext.Provider>
    );
}

export function useActividadesContext() {
    const ctx = useContext(ActividadesContext);
    if (!ctx) throw new Error('useActividadesContext debe usarse dentro de ActividadesProvider');
    return ctx;
}
