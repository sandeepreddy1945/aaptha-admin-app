import { cn } from "cn"

function Shimmer({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-block animate-[shimmer_1.6s_linear_infinite] bg-gradient-to-r from-muted-foreground/50 via-foreground to-muted-foreground/50 bg-[length:200%_100%] bg-clip-text text-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Shimmer }
