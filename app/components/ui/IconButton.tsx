import { Button, type ButtonProps } from "./Button";

/** A 44px square icon-only button; the label is required because there is no visible text. */
export type IconButtonProps = Omit<ButtonProps, "icon" | "variant" | "aria-label"> & {
  "aria-label": string;
  variant?: ButtonProps["variant"];
};

export function IconButton({ variant = "ghost", className = "", ...rest }: IconButtonProps) {
  return <Button variant={variant} icon className={`rounded-full ${className}`} {...rest} />;
}
