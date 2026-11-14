import type { FileSelectionPort } from '../../app/types.ts';
import type { BackupFacade } from './facade.ts';

export interface BackupViewProps {
  readonly facade: BackupFacade;
  readonly selectFile: FileSelectionPort;
}

// The Backup page: Download backup and Verify backup (D8 A141). Built by T8.12; T8.23 freezes the props.
export function BackupView(props: BackupViewProps) {
  void props;
  return null;
}
