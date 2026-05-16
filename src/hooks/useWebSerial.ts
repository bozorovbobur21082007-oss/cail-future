import { useEffect, useState } from 'react';
import { webSerialService, type SerialState } from '@/lib/webSerialService';

/**
 * Hook — singleton WebSerial xizmatini React state'iga ulaydi.
 * onRead callback ixtiyoriy: berilsa, har UID kelganda chaqiriladi.
 * Ulanishning o'zi global — komponent unmount bo'lsa ham uzilmaydi.
 */
export function useWebSerial(onRead?: (uid: string) => void) {
  const [state, setState] = useState<SerialState>(() => webSerialService.getState());

  useEffect(() => {
    webSerialService.init();
    const unsub = webSerialService.subscribe(setState);
    return unsub;
  }, []);

  useEffect(() => {
    if (!onRead) return;
    return webSerialService.onUid(onRead);
  }, [onRead]);

  return {
    connect: () => webSerialService.connect(),
    disconnect: () => webSerialService.disconnect(),
    clearLog: () => webSerialService.clearLog(),
    connected: state.connected,
    connecting: state.connecting,
    support: state.support,
    error: state.error,
    status: state.status,
    log: state.log,
  };
}
