import { Icon } from '@/shared/components/Icon';

/** A field the member still has to fill, said in words beside it. */
export function FieldError({ text, id }: { text: string; id?: string }) {
  return (
    <p id={id} className="cr-field-error" role="alert">
      <Icon name="info" size={15} strokeWidth={2.4} />
      {text}
    </p>
  );
}
