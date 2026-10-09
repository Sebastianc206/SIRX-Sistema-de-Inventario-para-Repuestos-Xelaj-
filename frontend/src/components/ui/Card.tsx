import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: "section" | "div" | "article";
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}

export function Card({ as: Tag = "section", title, description, actions, padded = true, className, children, ...rest }: CardProps) {
  return (
    <Tag className={`card${padded ? "" : " card--flush"}${className ? ` ${className}` : ""}`} {...rest}>
      {(title || actions) && (
        <header className="card-header">
          <div className="card-header-text">
            {title && <h3 className="card-title">{title}</h3>}
            {description && <p className="card-description">{description}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
