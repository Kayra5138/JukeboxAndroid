import { Fragment, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Dialog } from './Dialog';
import { OnAPage } from './OnAPage';
import { Pressable } from './Pressable';
import { useRows } from './settings/rows';

import { useT } from '../lib/i18n/index';
import { makeStyles, usePressed } from '../lib/theme/index';
import { LEADING, SPACE, TYPE } from '../lib/theme/measures';
import { haptic } from '../lib/ui/haptics';

type Asked<Value extends string> = {
  visible: boolean;
  heading: string;
  /** A line under the list about the choice as a whole. */
  note?: string;
  /**
   * `detail` is a line under a choice about that choice alone, for a list of
   * a few that differ in more than their names.
   */
  options: readonly { value: Value; label: string; detail?: string }[];
  chosen: Value;
  onChoose: (value: Value) => void;
  onClose: () => void;
  /**
   * What to show in place of the list of names, for a choice that is better
   * seen than read: the themes, each as it looks. Whatever it is does its own
   * choosing and closing; the names are then only what a screen reader would
   * have been given, and are not drawn.
   */
  picture?: ReactNode;
  /**
   * Asked on a page of its own, in the tab, rather than over everything: for
   * Settings, whose choices were sheets laid over a page that was itself
   * over another, with the bar of what is playing out of reach under them.
   */
  page?: boolean;
};

/**
 * Asks for one of a list, where the list is too long to lay out in a row.
 *
 * Three alternatives are chips beside the setting's name and need no dialog.
 * Fifty languages are not, and this is where they go: the same sheet a line of
 * text is asked for on, with the list in place of the field and a tick against
 * the one already chosen. Choosing is the whole of the transaction — a tap
 * picks and closes, since there is nothing else here to confirm.
 */
export function OptionSheet<Value extends string>({ page = false, ...asked }: Asked<Value>) {
  return page ? <AskedOnAPage {...asked} /> : <AskedInASheet {...asked} />;
}

/**
 * The same choice on a page of its own (`OnAPage`): a tap chooses and closes,
 * as in the sheet, which takes the page away; Back closes having chosen nothing.
 */
function AskedOnAPage<Value extends string>({ visible, heading, note, options, chosen, onChoose, onClose, picture }: Omit<Asked<Value>, 'page'>) {
  return (
    <OnAPage visible={visible} title={heading} onClose={onClose}>
      <ChoiceList note={note} options={options} chosen={chosen} picture={picture} onChoose={(value) => {
        onChoose(value);
        onClose();
      }} />
    </OnAPage>
  );
}

/** The choices as rows of Settings, the chosen one ticked: see [AskedOnAPage]. */
function ChoiceList<Value extends string>({
  note,
  options,
  chosen,
  picture,
  onChoose,
}: Pick<Asked<Value>, 'note' | 'options' | 'chosen' | 'picture' | 'onChoose'>) {
  const rows = useRows();
  const styles = useStyles();
  const pressed = usePressed();
  return (
    <>
      {picture ?? (
        <View style={rows.card}>
          {options.map((option, index) => {
            const on = option.value === chosen;
            return (
              <Fragment key={option.value}>
                {index > 0 ? <View style={rows.rule} /> : null}
                <Pressable
                  android_ripple={pressed}
                  // One of a set of which one is the answer, and says which.
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={rows.row}
                  onPress={() => {
                    if (!on) haptic('choices', 'click');
                    onChoose(option.value);
                  }}>
                  <View style={rows.line}>
                    <Text style={[rows.title, on && styles.labelOn]}>{option.label}</Text>
                    {on ? <Text style={styles.tick} importantForAccessibility="no">✓</Text> : null}
                  </View>
                  {option.detail ? <Text style={rows.muted}>{option.detail}</Text> : null}
                </Pressable>
              </Fragment>
            );
          })}
        </View>
      )}
      {note ? <Text style={rows.aside}>{note}</Text> : null}
    </>
  );
}

function AskedInASheet<Value extends string>({
  visible,
  heading,
  note,
  options,
  chosen,
  onChoose,
  onClose,
  picture,
}: Omit<Asked<Value>, 'page'>) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={heading}
      edge
      answers={[{ label: t.common.cancel, kind: 'quiet', onPress: onClose }]}>
          <ScrollView style={styles.list} contentContainerStyle={picture ? styles.pictured : undefined}>
            {picture ?? options.map((option) => {
              const on = option.value === chosen;
              return (
                <Pressable
                  android_ripple={pressed}
                  key={option.value}
                  // One of a set of which one is the answer, and says which.
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={styles.option}
                  onPress={() => {
                    if (!on) haptic('choices', 'click');
                    onChoose(option.value);
                    onClose();
                  }}>
                  {option.detail ? (
                    <View style={styles.told}>
                      <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                        {option.label}
                      </Text>
                      <Text style={styles.detail}>{option.detail}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                      {option.label}
                    </Text>
                  )}
                  {on ? <Text style={styles.tick} importantForAccessibility="no">✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {note ? <Text style={styles.note}>{note}</Text> : null}
    </Dialog>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  list: { flexGrow: 0 },
  pictured: { paddingHorizontal: SPACE.l },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
  },
  label: { color: c.text, fontSize: TYPE.body, flexShrink: 1 },
  labelOn: { color: c.accent },
  told: { flexShrink: 1, gap: SPACE.xxs },
  detail: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint },
  tick: { color: c.accent, fontSize: 15, fontWeight: '700' },
  note: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, paddingHorizontal: SPACE.l },
}));
