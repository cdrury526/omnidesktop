/**
 * @omni/forms-dsl — the declarative form language shared by the forms MCP App
 * server (renders it) and the Omni Desktop host (validates results against it).
 * One source of truth so the agent's schema, the renderer, and the validators
 * can't drift.
 */
export { DSL_VERSION, type DslVersion } from "./version";
export {
  FIELD_TYPES,
  CHOICE_TYPES,
  type FieldType,
  type Option,
  type Field,
  type TextField,
  type NumberField,
  type ChoiceField,
  type MultiChoiceField,
  type BooleanField,
  type DateField,
  type InfoField,
  type FormStep,
  type FormSpec,
  type FormValues,
  optionValue,
  optionLabel,
  isInputField,
} from "./fields";
export {
  type Scalar,
  type Condition,
  type FormValue,
  evalCondition,
  conditionFields,
} from "./condition";
export { toSteps, allFields } from "./normalize";
export {
  type Issue,
  type SpecCheck,
  type ResultCheck,
  validateSpec,
  validateResult,
} from "./validate";
export {
  REQUEST_INPUT_TOOL,
  REQUEST_INPUT_DESCRIPTION,
  requestInputSchema,
} from "./schema";
export {
  INTERACTIVE_TOOL_META,
  FORM_SUBMIT_KEY,
  type FormSubmitPayload,
  isFormSubmit,
} from "./protocol";
