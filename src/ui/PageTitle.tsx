import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import { WarningIcon } from './icons.tsx';
import { useRuntime } from './runtime.tsx';

// A screen's page h1 with the storage warning icon at the far right of its row (T2.60-B4). The shell
// alone decides whether the icon shows (RuntimeState.storageIconTo), so no screen repeats the condition.
export function PageTitle(props: ComponentProps<'h1'>) {
  const { storageIconTo } = useRuntime();
  return (
    <div className="title-row">
      <h1 {...props} />
      {storageIconTo !== undefined && (
        <Link className="storage-flag" to={storageIconTo} aria-label="Storage not protected: see About">
          <WarningIcon />
        </Link>
      )}
    </div>
  );
}
