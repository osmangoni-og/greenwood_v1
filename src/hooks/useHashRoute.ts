import { useEffect, useState } from 'react';
import { isModuleId, getRedirectModule, type ModuleId } from '@/lib/modules';

const DEFAULT_ROUTE: ModuleId = 'dashboard';

function readRoute(): ModuleId {
  const id = window.location.hash.replace(/^#\//, '');
  if (!isModuleId(id)) return DEFAULT_ROUTE;
  const redirect = getRedirectModule(id);
  if (redirect) {
    window.location.hash = `#/${redirect}`;
    return redirect;
  }
  return id;
}

export function useHashRoute(): ModuleId {
  const [route, setRoute] = useState<ModuleId>(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
