import { TextPrompt } from './TextPrompt';

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
  return (
    <TextPrompt
      visible={visible}
      heading={`Add a tag to ${count} ${count === 1 ? 'track' : 'tracks'}`}
      placeholder="Tag"
      confirmLabel="Add"
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}
