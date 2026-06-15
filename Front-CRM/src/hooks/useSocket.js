import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getApiBaseUrl } from '../utils/apiBase';

let socket = null;

export default function useSocket() {
    const ref = useRef(null);

    if (!socket) {
        socket = io(getApiBaseUrl(), {
            auth: { token: localStorage.getItem('crm_token') },
        });
    }
    ref.current = socket;

    useEffect(() => {
        return () => {};
    }, []);

    return ref.current;
}
