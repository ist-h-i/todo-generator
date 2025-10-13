I’ll fix the Angular build error by making `onTouched` public in the shared select component, then outline the shadcn/Tailwind/React integration with exact file paths and commands.

**Angular Fix (Build Error)**
- Root cause: Angular templates can only access public members. `(blur)="onTouched()"` calls a private member.
- Change made: Made `onTouched` public.
  - File: frontend/src/app/shared/ui/select/ui-select.ts:1
  - Diff summary:
    - Before: `private onTouched: () => void = () => {};`
    - After: `public onTouched: () => void = () => {};`
  - Reference: frontend/src/app/shared/ui/select/ui-select.ts:34 calls `onTouched()` from the template.
- Verify: `cd frontend && npm run build` (expect no TS2341 error)

**Selector Design**
- Existing centralized SCSS changes remain intact. No further template/TS changes required here.

**shadcn React Select Integration**
- Current repo is Angular (Tailwind already present for Angular). There’s no React app in this repo, so below are complete setup/integration instructions to add when/if a React (e.g., Next.js) app exists.

- Why `components/ui` matters:
  - shadcn UI defaults to `components/ui` for primitives.
  - Keeps primitives discoverable and consistent; shadcn CLI and docs assume it.

- Prereqs if you don’t have a React app:
  - Create a Next.js TypeScript app: `npx create-next-app@latest --ts`
  - Install Tailwind: `npx tailwindcss init -p` and configure `tailwind.config.ts` and globals per Tailwind docs
  - Initialize shadcn: `npx shadcn@latest init`
  - Ensure path alias `@` points to project root `src` (e.g., `tsconfig.json` paths) and add `@/lib/utils.ts` with `cn` helper.

- Install dependencies in the React app:
  - `npm i @radix-ui/react-select @radix-ui/react-icons`

- Add utility:
  - File: `src/lib/utils.ts`
  - Contents:
    - `export function cn(...classes: (string | undefined | null | false)[]) { return classes.filter(Boolean).join(' '); }`

- Add components (create folder if missing):
  - File: `src/components/ui/select.tsx`
    - Paste the provided Select component code (unchanged).
  - File: `src/components/ui/label.tsx`
    - Paste the provided Label component code (unchanged).

- Demo usage:
  - File: `src/app/(or pages)/demo.tsx` (or any route/sandbox)
  - Paste the provided `demo.tsx` usage example and render the component.

- Expected styles:
  - Tailwind CSS must be active in your React app; the component uses Tailwind tokens (e.g., `border-input`, `bg-background`) commonly defined by shadcn’s theme.

**Files to Copy-Paste (React App)**

- components/ui/select.tsx
"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import * as React from "react";

import { cn } from "@/lib/utils";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-start text-sm text-foreground shadow-sm shadow-black/5 focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground/70 [&>span]:min-w-0",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon size={16} strokeWidth={2} className="shrink-0 text-muted-foreground/80" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUpIcon size={16} strokeWidth={2} />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDownIcon size={16} strokeWidth={2} />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h=[min(24rem,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden rounded-lg border border-input bg-popover text-popover-foreground shadow-lg shadow-black/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 [&_[role=group]]:py-1",
        position === "popper" &&
          "w-full min-w-[var(--radix-select-trigger-width)] data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)]")}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pe-2 ps-8 text-xs font-medium text-muted-foreground", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pe-2 ps-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute start-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon size={16} strokeWidth={2} />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};

- components/ui/label.tsx
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-4 text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Label };

- demo.tsx (example usage)
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useId } from "react";

function Component() {
  const id = useId();
  return (
    <div className="space-y-2 min-w-[300px]">
      <Label htmlFor={id}>Simple select with default value</Label>
      <Select defaultValue="1">
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select framework" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">React</SelectItem>
          <SelectItem value="2">Next.js</SelectItem>
          <SelectItem value="3">Astro</SelectItem>
          <SelectItem value="4">Gatsby</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export { Component };

**Install Commands (React App)**
- `npm i @radix-ui/react-select @radix-ui/react-icons`

**Questions**
- Should the React Select be integrated into a new/existing React app now, or is preparing the components sufficient?
- Any RTL or legacy browser requirements for the selector visuals?
- Pages/components that must keep the current selector look and be excluded from the global style?

If you’d like, I can proceed to wire a minimal Next.js + Tailwind + shadcn sandbox and drop these components into `components/ui` for you.