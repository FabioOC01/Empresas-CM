import { useState, useEffect } from 'react';
import { getActividades } from '../api/actividades';
import useSocket from './useSocket';

export default function useActividades() {
    const [actividades, setActividades] = useState([]);
    const [loading, setLoading] = useState(true);
    const socket = useSocket();

    useEffect(() => {
        getActividades()
            .then(setActividades)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onCreada     = (a)      => setActividades(prev => [a, ...prev]);
        const onActualizada = (a)     => setActividades(prev => prev.map(x => x.id === a.id ? a : x));
        const onEliminada  = ({ id }) => setActividades(prev => prev.filter(x => x.id !== id));

        socket.on('actividad:creada',      onCreada);
        socket.on('actividad:actualizada', onActualizada);
        socket.on('actividad:eliminada',   onEliminada);

        return () => {
            socket.off('actividad:creada',      onCreada);
            socket.off('actividad:actualizada', onActualizada);
            socket.off('actividad:eliminada',   onEliminada);
        };
    }, [socket]);

    return { actividades, setActividades, loading };
}
