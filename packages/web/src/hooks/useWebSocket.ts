import { useCallback, useEffect, useRef, useState } from 'react';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected';

export interface WebSocketOptions {
  maxAttempts?: number;
  baseDelay?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectOnMount?: boolean;
}

export interface UseWebSocketReturn {
  status: WebSocketStatus;
  connect: () => void;
  disconnect: () => void;
  send: (data: unknown) => void;
  reconnectAttempts: number;
  lastMessage: unknown;
}

const DEFAULT_OPTIONS: Required<WebSocketOptions> = {
  maxAttempts: 10,
  baseDelay: 1000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  onMessage: () => {},
  onConnect: () => {},
  onDisconnect: () => {},
  onError: () => {},
  reconnectOnMount: true,
};

export const useWebSocket = (
  url: string,
  options: WebSocketOptions = {}
): UseWebSocketReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const reconnectAttemptsRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    heartbeatTimeoutRef.current = setTimeout(() => {
      // Heartbeat timeout - connection might be dead
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    }, opts.heartbeatTimeout);
  }, [opts.heartbeatTimeout]);

  const startHeartbeat = useCallback(() => {
    clearTimers();
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        resetHeartbeat();
      }
    }, opts.heartbeatInterval);
  }, [opts.heartbeatInterval, resetHeartbeat, clearTimers]);

  const connect = useCallback(() => {
    // Don't connect if already connecting or connected
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    clearTimers();
    setStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
        opts.onConnect();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle pong response
          if (data.type === 'pong') {
            resetHeartbeat();
            return;
          }
          setLastMessage(data);
          opts.onMessage(data);
        } catch {
          // Handle non-JSON messages
          setLastMessage(event.data);
          opts.onMessage(event.data);
        }
      };

      ws.onerror = (error) => {
        opts.onError(error);
      };

      ws.onclose = (event) => {
        setStatus('disconnected');
        clearTimers();
        opts.onDisconnect();

        // Don't reconnect if closed intentionally (code 1000)
        if (event.code === 1000) {
          return;
        }

        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < opts.maxAttempts) {
          const delay = opts.baseDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      setStatus('disconnected');
      // Retry connection on error
      if (reconnectAttemptsRef.current < opts.maxAttempts) {
        const delay = opts.baseDelay * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    }
  }, [url, opts, clearTimers, startHeartbeat, resetHeartbeat]);

  const disconnect = useCallback(() => {
    clearTimers();
    reconnectAttemptsRef.current = 0; // Reset attempts on manual disconnect

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [clearTimers]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
    }
  }, []);

  // Connect on mount if reconnectOnMount is true
  useEffect(() => {
    if (opts.reconnectOnMount && url) {
      connect();
    }

    return () => {
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
        wsRef.current = null;
      }
    };
  }, [url]); // Only run on mount/unmount

  return {
    status,
    connect,
    disconnect,
    send,
    reconnectAttempts: reconnectAttemptsRef.current,
    lastMessage,
  };
};

export default useWebSocket;
