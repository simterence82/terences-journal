import { useEffect, useState } from "react";
import { onSnapshot, type Query } from "firebase/firestore";

// Live-updating replacement for a one-shot getDocs() + TanStack Query read.
// Firestore pushes every change (from any browser) straight into this
// listener, so all connected users see the same data without a manual
// refresh.
export function useCollectionQuery<T>(
  buildQuery: () => Query,
  mapDoc: (id: string, data: Record<string, any>) => T,
  sortFn: (a: T, b: T) => number
): { data: T[] | undefined; isLoading: boolean; error: Error | null } {
  const [data, setData] = useState<T[] | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      buildQuery(),
      (snap) => {
        const items = snap.docs.map((d) => mapDoc(d.id, d.data()));
        items.sort(sortFn);
        setData(items);
      },
      (err) => setError(err as Error)
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, isLoading: data === undefined && error === null, error };
}

interface CollectionSource<T> {
  key: string;
  buildQuery: () => Query;
  mapDoc: (id: string, data: Record<string, any>) => T;
}

// Same idea, but merges live listeners across several collections into one
// combined, sorted list (used by the Trash Bin and Files Archive views).
export function useMultiCollectionQuery<T>(
  sources: CollectionSource<T>[],
  sortFn: (a: T, b: T) => number
): { data: T[] | undefined; isLoading: boolean; error: Error | null } {
  const [dataByKey, setDataByKey] = useState<Record<string, T[]>>({});
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribes = sources.map((source) =>
      onSnapshot(
        source.buildQuery(),
        (snap) => {
          const items = snap.docs.map((d) => source.mapDoc(d.id, d.data()));
          setDataByKey((prev) => ({ ...prev, [source.key]: items }));
        },
        (err) => setError(err as Error)
      )
    );
    return () => unsubscribes.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const receivedAll = sources.every((s) => s.key in dataByKey);
  const data = receivedAll ? sources.flatMap((s) => dataByKey[s.key]).sort(sortFn) : undefined;

  return { data, isLoading: data === undefined && error === null, error };
}
