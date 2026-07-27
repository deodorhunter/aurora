import { useMemo } from 'react';
import { Select, SelectItem } from '@plone/components/quanta';

/**
 * Widget for a schema field that offers a fixed set of `choices`.
 *
 * `Field.tsx` has always had a resolution step for these
 * (`getWidgetByChoices` → `config.widgets.choices`), but nothing ever filled
 * that slot, so every `choices` field silently fell through to the default text
 * field — the user typed a token by hand, or the field was unusable. Any block
 * schema with an enumerated field (a Listing's layout variation, a heading
 * level) needs this to exist before it is worth writing.
 *
 * `choices` follows the shape the backend and Volto both use: `[value, label]`
 * pairs. A bare `string[]` is accepted too, where the value is its own label.
 */
export interface ChoicesWidgetProps {
  id?: string;
  label?: string;
  description?: string;
  errorMessage?: string;
  choices?: Array<[string, string] | string>;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
}

function normalizeChoices(
  choices: ChoicesWidgetProps['choices'],
): Array<{ value: string; label: string }> {
  if (!Array.isArray(choices)) return [];
  return choices.map((choice) =>
    Array.isArray(choice)
      ? { value: String(choice[0]), label: String(choice[1] ?? choice[0]) }
      : { value: String(choice), label: String(choice) },
  );
}

export function ChoicesWidget({
  label,
  description,
  errorMessage,
  choices,
  value,
  defaultValue,
  required,
  isDisabled,
  onChange,
  className,
}: ChoicesWidgetProps) {
  const items = useMemo(() => normalizeChoices(choices), [choices]);
  // Uncontrolled unless the caller actually controls it: the block settings
  // form hands the current value in as `defaultValue` and re-keys the form
  // when the underlying data changes, the same contract every other widget
  // there is rendered under.
  const selectedKey = value ?? defaultValue ?? null;

  return (
    <Select
      label={label}
      description={description}
      errorMessage={errorMessage}
      isRequired={required}
      isDisabled={isDisabled}
      className={className}
      selectedKey={selectedKey}
      onSelectionChange={(key) => key != null && onChange?.(String(key))}
    >
      {items.map((item) => (
        <SelectItem key={item.value} id={item.value}>
          {item.label}
        </SelectItem>
      ))}
    </Select>
  );
}

export default ChoicesWidget;
