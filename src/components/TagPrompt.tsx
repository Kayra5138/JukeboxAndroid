import { TextPrompt } from './TextPrompt';
import { useT } from '../lib/i18n/index';

/** Asks for one tag to put on a run of tracks. */
export function TagPrompt({
  visible,
  count,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  count: number;
  onSubmit: (tag: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <TextPrompt
      visible={visible}
      heading={t.details.tagPrompt.heading(count)}
      placeholder={t.details.tagPrompt.placeholder}
      confirmLabel={t.common.add}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}
