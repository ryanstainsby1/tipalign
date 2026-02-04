import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useRealtimeEntity(entityName, filterFn = null) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities[entityName].list().then(items => {
      setData(filterFn ? items.filter(filterFn) : items);
      setLoading(false);
    });

    const unsubscribe = base44.entities[entityName].subscribe((event) => {
      setData(prev => {
        let updated;
        if (event.type === "create") updated = [...prev, event.data];
        else if (event.type === "update") updated = prev.map(item =>
          item.id === event.id ? { ...item, ...event.data } : item);
        else if (event.type === "delete") updated = prev.filter(item => item.id !== event.id);
        else updated = prev;
        return filterFn ? updated.filter(filterFn) : updated;
      });
    });

    return () => unsubscribe();
  }, [entityName]);

  return { data, loading };
}