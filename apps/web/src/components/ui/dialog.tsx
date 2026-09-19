import { Dialog } from '@base-ui/react/dialog'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

function DialogRoot(props: ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />
}

function DialogPortal(props: ComponentProps<typeof Dialog.Portal>) {
  return <Dialog.Portal {...props} />
}

function DialogBackdrop({
  className,
  ...props
}: ComponentProps<typeof Dialog.Backdrop>) {
  return (
    <Dialog.Backdrop
      className={cn(
        'fixed inset-0 z-50 bg-black/50 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

function DialogPopup({
  className,
  ...props
}: ComponentProps<typeof Dialog.Popup>) {
  return (
    <Dialog.Popup
      className={cn(
        'bg-background fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,40rem)] w-[min(calc(100%-2rem),36rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border shadow-lg outline-none transition-all data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={cn('font-heading text-lg font-medium tracking-tight', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof Dialog.Description>) {
  return (
    <Dialog.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function DialogClose(props: ComponentProps<typeof Dialog.Close>) {
  return <Dialog.Close {...props} />
}

export {
  DialogRoot as Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
