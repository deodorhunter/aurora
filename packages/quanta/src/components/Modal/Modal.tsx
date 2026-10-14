import React from 'react';
import {
  ModalOverlay,
  type ModalOverlayProps,
  Modal as RACModal,
} from 'react-aria-components/Modal';
import { tv } from 'tailwind-variants';

const overlayStyles = tv({
  base: `
    absolute top-0 left-0 isolate z-20 h-(--page-height) w-full bg-black/50 text-center
    backdrop-blur-lg
  `,
  variants: {
    isEntering: {
      true: 'duration-200 ease-out animate-in fade-in',
    },
    isExiting: {
      true: 'duration-200 ease-in animate-out fade-out',
    },
  },
});

const modalStyles = tv({
  base: `
    max-h-[calc(var(--visual-viewport-height)*.9)] w-full max-w-[90vw] rounded-md border
    border-black/10 bg-white bg-clip-padding text-left align-middle text-neutral-700 shadow-2xl
    dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-300 dark:backdrop-blur-2xl
    dark:backdrop-saturate-200
    forced-colors:bg-[Canvas]
  `,
  variants: {
    isEntering: {
      true: 'duration-200 ease-out animate-in zoom-in-105',
    },
    isExiting: {
      true: 'duration-200 ease-in animate-out zoom-out-95',
    },
  },
});

export function Modal(props: ModalOverlayProps) {
  // PATCHED (aurora-template-studio, ATS-620): the overlay-only props were
  // being spread onto the inner RACModal too, which — since this Modal
  // always nests RACModal inside its own ModalOverlay — made React Aria
  // Components 1.22 log "This modal is already wrapped in a ModalOverlay,
  // props […] should be placed on the ModalOverlay instead" on every
  // controlled open (`isOpen`/`onOpenChange`/`isDismissable`, the exact
  // pattern every Studio dialog uses). RACModal picks these up from the
  // ModalOverlay's own context once it isn't handed a redundant copy.
  const {
    isDismissable,
    isKeyboardDismissDisabled,
    isOpen,
    defaultOpen,
    onOpenChange,
    isEntering,
    isExiting,
    UNSTABLE_portalContainer,
    shouldCloseOnInteractOutside,
    ...modalProps
  } = props;
  return (
    <ModalOverlay {...props} className={overlayStyles}>
      <div
        className={`
          sticky top-0 left-0 box-border flex h-(--visual-viewport-height) w-full items-center
          justify-center
        `}
      >
        <RACModal {...modalProps} className={modalStyles} />
      </div>
    </ModalOverlay>
  );
}
