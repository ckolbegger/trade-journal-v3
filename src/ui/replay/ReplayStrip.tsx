import type { LongStockReplayModel } from '../../trade-analysis/replay';
import styles from '../shell/AppShell.module.css';
import rpStyles from './Replay.module.css';
import { ReplaySparkline } from './ReplaySparkline';

interface ReplayStripProps {
  readonly model: LongStockReplayModel;
  readonly onOpen: (triggerEl: HTMLButtonElement) => void;
}

export function ReplayStrip({ model, onOpen }: ReplayStripProps) {
  return (
    <div className={rpStyles.strip}>
      <ReplaySparkline model={model} />
      <p className={rpStyles.stripText}>{model.summaryLine}</p>
      <button
        type="button"
        className={`${model.highlightPrimary ? styles.btnPrimary : styles.btnSecondary} ${rpStyles.stripAction}`}
        onClick={(e) => onOpen(e.currentTarget)}
      >
        Replay
      </button>
    </div>
  );
}
