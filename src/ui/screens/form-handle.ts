// What the Review asks of an unsaved form when the trader pressed another Trade (W128): save it as its own Save does, or return to it.
export interface FormHandle {
  // True once the form's own save accepted it; false when it was refused or could not be saved, its refusal shown in the form.
  readonly save: () => Promise<boolean>;
  readonly focus: () => void;
}

// How a form offers itself to the Review under the id it reports its values by, and withdraws.
export type FormRegister = (id: string, handle: FormHandle | undefined) => void;
