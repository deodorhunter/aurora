import {
  Accordion,
  AccordionItem,
  AccordionItemTrigger,
  AccordionPanel,
} from '@plone/components/quanta';
import type { PrimitiveAtom } from 'jotai';

type RendererSchema = {
  fieldsets: Array<{ id: string; title: string; fields: string[] }>;
  properties: Record<string, any>;
  required: string[];
};

type BaseFieldExtraProps = {
  formAtom?: PrimitiveAtom<any>;
  onChange?: (value: unknown) => void;
  /**
   * For widgets that resolve *derived* data alongside their own field value —
   * the Querystring widget resolves the matching content into the Listing
   * block's `items` — and so need to write a key `onChange` cannot express
   * (`onChange` owns exactly one field, the one the widget is bound to).
   */
  onPatchFormData?: (partial: Record<string, unknown>) => void;
};

type BlockSettingsFormRendererProps = {
  schema: RendererSchema;
  form: any;
  getFieldProps: (fieldName: string) => BaseFieldExtraProps;
};

const BlockSettingsFormRenderer = ({
  schema,
  form,
  getFieldProps,
}: BlockSettingsFormRendererProps) => {
  return (
    <form>
      {schema.fieldsets.map((fieldset) => (
        <Accordion defaultExpandedKeys={['default']} key={fieldset.id}>
          <AccordionItem id={fieldset.id}>
            <AccordionItemTrigger>{fieldset.title}</AccordionItemTrigger>
            <AccordionPanel>
              {fieldset.fields.map((schemaField, index) => (
                <form.AppField
                  name={schemaField}
                  key={index}
                  // eslint-disable-next-line react/no-children-prop
                  children={(field: any) => (
                    <field.Quanta
                      {...schema.properties[schemaField]}
                      className="mb-4"
                      label={schema.properties[field.name].title}
                      name={field.name}
                      defaultValue={field.state.value}
                      required={schema.required.indexOf(schemaField) !== -1}
                      error={field.state.meta.errors}
                      {...getFieldProps(String(field.name))}
                    />
                  )}
                />
              ))}
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      ))}
    </form>
  );
};

export default BlockSettingsFormRenderer;
