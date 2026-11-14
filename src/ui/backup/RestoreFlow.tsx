import type { FileSelectionPort } from '../../app/types.ts';
import type { BackupFacade } from './facade.ts';

export interface RestoreFlowProps {
  readonly facade: BackupFacade;
  readonly selectFile: FileSelectionPort;
}

// The Restore flow: choose, preview, confirm, result (D8 A142). Built by T8.13; T8.23 freezes the props.
export function RestoreFlow(props: RestoreFlowProps) {
  void props;
  return null;
}
