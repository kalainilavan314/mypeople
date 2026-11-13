import { createContext, type ReactNode, useContext } from 'react';

import type { TypographyScale } from '../fonts';

const TypographyContext = createContext<TypographyScale>('default');

type Props = {
  scale: TypographyScale;
  children: ReactNode;
};

/** Lets a native app select a readable scale without changing the locked fonts. */
export function AppTypographyProvider({ scale, children }: Props) {
  return <TypographyContext.Provider value={scale}>{children}</TypographyContext.Provider>;
}

export function useTypographyScale(): TypographyScale {
  return useContext(TypographyContext);
}
