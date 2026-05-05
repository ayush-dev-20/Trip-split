import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-react';
import { useAuthStore } from '@/stores/authStore';
import { getClerkToken } from '@/lib/clerkHelper';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  joinTrip: (tripId: string) => void;
  leaveTrip: (tripId: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  joinTrip: () => {},
  leaveTrip: () => {},
});

// In dev the Vite proxy doesn't cover /socket.io, so connect directly to the API server.
// In production the socket server is on the same origin.
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    // Create socket synchronously so the cleanup function always has a reference to it.
    // The auth token is fetched lazily via a callback — Socket.io calls it on every
    // (re)connect, which is the correct place to refresh a short-lived JWT.
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (cb: (data: Record<string, unknown>) => void) => {
        getClerkToken().then((token) => cb({ token: token ?? '' }));
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Subscribe to personal notification room
      socket.emit('join:user', user.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] connect_error:', err.message);
    });

    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      // Cleanup always runs against the local `socket` reference,
      // so it works even if the effect is torn down before the token fetch resolves.
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isSignedIn, user]);

  function joinTrip(tripId: string) {
    socketRef.current?.emit('join:trip', tripId);
  }

  function leaveTrip(tripId: string) {
    socketRef.current?.emit('leave:trip', tripId);
  }

  return (
    <SocketContext.Provider
      value={{ socket: socketRef.current, isConnected, joinTrip, leaveTrip }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Subscribe to a socket event; auto-unsubscribes on unmount. */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void
) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [socket, event, handler]);
}
