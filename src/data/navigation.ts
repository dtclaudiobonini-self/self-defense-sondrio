export const primaryNavigation = [
  { label: 'Home', href: '/' },
  { label: 'Corsi', href: '/corsi', children: [{ label: 'Metodo', href: '/metodo' }] },
  { label: 'Associazione', href: '/associazione', children: [{ label: 'Staff', href: '/staff' }] },
  { label: 'News', href: '/news' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contatti', href: '/contatti' }
] as const;
