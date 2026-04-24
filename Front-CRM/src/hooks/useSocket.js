import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export default function useSocket() {
    const ref = useRef(null);

    if (!socket) {
        socket = io(import.meta.env.VITE_API_URL, {
            auth: { token: localStorage.getItem('crm_token') },
        });
    }
    ref.current = socket;

    useEffect(() => {
        return () => {};
    }, []);

    return ref.current;
}
