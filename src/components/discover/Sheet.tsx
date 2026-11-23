import type { ReactNode } from 'react';

import { MenuPage } from '../MenuPage';

/**
 * Discover's menus and its note on itself: a page of its own in the tab, the
 * bars where they are, or a sheet where there is no tab (`MenuPage`).
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  /** The page's name in its bar. */
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <MenuPage visible={visible} title={title} onClose={onClose}>
      {children}
    </MenuPage>
  );
}
