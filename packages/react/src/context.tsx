'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createArclightClient, type ArclightClient } from '@arclighthq/sdk';

interface ArclightContextValue {
  client: ArclightClient;
  /** Where the server handler is mounted, for requests the typed client can't make (streams). */
  basePath: string;
  /** Builds the link to a lead's page in the host app, or null to show names without links. */
  leadHref: (id: string) => string | null;
}

const ArclightContext = createContext<ArclightContextValue | null>(null);

export interface ArclightProviderProps {
  /** Where the handler from `@arclighthq/react/server` is mounted. Default `/api/arclight`. */
  basePath?: string;
  /**
   * Link to a lead's page in your app, with `:id` for the lead id, e.g. `/admin/leads/:id`.
   * Without it, lead names are shown without links.
   */
  leadUrl?: string;
  /** `light` or `dark` to fix the colours; by default they follow the system setting. */
  theme?: 'light' | 'dark';
  children: ReactNode;
}

/** Connects the Arclight components to your server's Arclight handler. */
export function ArclightProvider({
  basePath = '/api/arclight',
  leadUrl,
  theme,
  children,
}: ArclightProviderProps) {
  const value = useMemo<ArclightContextValue>(
    () => ({
      // No API key here: the handler on your server adds it.
      client: createArclightClient({ baseUrl: basePath }),
      basePath: basePath.replace(/\/+$/, ''),
      leadHref: (id) => (leadUrl ? leadUrl.replace(':id', encodeURIComponent(id)) : null),
    }),
    [basePath, leadUrl],
  );
  return (
    <ArclightContext.Provider value={value}>
      <div className="arc-root" data-theme={theme}>
        {children}
      </div>
    </ArclightContext.Provider>
  );
}

export function useArclight(): ArclightContextValue {
  const value = useContext(ArclightContext);
  if (!value) throw new Error('Wrap Arclight components in <ArclightProvider>.');
  return value;
}

type ApiResult<T> = Promise<{ data?: T; error?: { error: { message: string } } }>;

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data from the Arclight API and reloads it on request, or every `refreshMs` while
 * `shouldRefresh` says the data is still changing (e.g. an audit is running).
 */
export function useArclightQuery<T>(
  load: (client: ArclightClient) => ApiResult<T>,
  key: string,
  {
    refreshMs = 3000,
    shouldRefresh,
  }: { refreshMs?: number; shouldRefresh?: (data: T) => boolean } = {},
): QueryState<T> {
  const { client } = useArclight();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  const refresh = useRef(shouldRefresh);
  refresh.current = shouldRefresh;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    loader
      .current(client)
      .then(({ data: result, error: failure }) => {
        if (cancelled) return;
        setError(failure ? failure.error.message : null);
        if (result !== undefined) {
          setData(result);
          if (refresh.current?.(result)) {
            timer = setTimeout(() => setVersion((v) => v + 1), refreshMs);
          }
        }
      })
      .catch(() => !cancelled && setError('Arclight is not reachable.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, key, version, refreshMs]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
