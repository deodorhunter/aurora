import type { ConfigType } from '@plone/registry';
import {
  AlignWidget,
  Checkbox,
  DateTimePicker,
  SizeWidget,
  WidthWidget,
  TextField,
} from '@plone/components/quanta';
import { DateField } from '@plone/components';
import { RecurrenceWidget } from '../components/RecurrenceWidget/RecurrenceWidget';
import { ObjectBrowserWidget } from '../components/ObjectBrowserWidget/ObjectBrowserWidget';
import ImageWidget from '../components/ImageWidget/ImageWidget';
import { QuerystringWidget } from '../components/QuerystringWidget/QuerystringWidget';
import { ChoicesWidget } from '../components/ChoicesWidget/ChoicesWidget';

export default function install(config: ConfigType) {
  config.registerDefaultWidget(TextField);

  // Fills the `choices` slot `Field.tsx`'s `getWidgetByChoices` has always
  // looked up and never found — without it every enumerated schema field
  // degraded to a free-text box. Assigned rather than registered: like
  // `default`, `widgets.choices` holds a single component instead of a
  // name→component map, so it falls outside `registerWidget`'s
  // `MappableWidgetKeys` and has no registrar of its own.
  config.widgets.choices = ChoicesWidget;

  config.registerWidget({
    key: 'id',
    definition: { recurrence: RecurrenceWidget },
  });
  config.registerWidget({ key: 'widget', definition: { date: DateField } });
  config.registerWidget({
    key: 'widget',
    definition: { datetime: DateTimePicker },
  });
  config.registerWidget({ key: 'widget', definition: { boolean: Checkbox } });
  config.registerWidget({
    key: 'widget',
    definition: { align: AlignWidget },
  });
  config.registerWidget({
    key: 'widget',
    definition: { size: SizeWidget },
  });
  config.registerWidget({
    key: 'widget',
    definition: { width: WidthWidget },
  });
  config.registerWidget({
    key: 'widget',
    definition: { image: ImageWidget },
  });
  config.registerWidget({
    key: 'factory',
    definition: {
      'Relation List': ObjectBrowserWidget,
    },
  });
  config.registerWidget({
    key: 'widget',
    definition: {
      object_browser: ObjectBrowserWidget,
    },
  });
  config.registerWidget({
    key: 'widget',
    definition: {
      querystring: QuerystringWidget,
    },
  });
  config.registerWidget({
    key: 'vocabulary',
    definition: {
      'plone.app.vocabularies.Catalog': ObjectBrowserWidget,
    },
  });

  return config;
}
