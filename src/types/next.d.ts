// Type declarations for Next.js modules used in the project
declare module 'next/link' {
  import type { ComponentPropsWithoutRef, ElementType } from 'react';
  const Link: <C extends ElementType = 'a'>(props: ComponentPropsWithoutRef<C> & { href: string; passHref?: boolean }) => JSX.Element;
  export default Link;
}

declare module 'next/image' {
  import type { ImgHTMLAttributes } from 'react';
  const Image: (props: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string; width?: number; height?: number; className?: string; priority?: boolean }) => JSX.Element;
  export default Image;
}

declare module 'next/navigation' {
  export function useRouter(): any;
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function redirect(url: string, type?: 'replace' | 'push'): never;
  export function useParams(): any;
}

