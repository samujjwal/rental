import React from 'react';
import { 
    Card as MuiCard, 
    CardContent as MuiCardContent,
    CardHeader as MuiCardHeader,
    CardProps as MuiCardProps,
    CardContentProps as MuiCardContentProps,
    CardHeaderProps as MuiCardHeaderProps
} from '@mui/material';
import { Typography } from '@mui/material';

export interface CardProps extends MuiCardProps {
    children: React.ReactNode;
}

export interface CardContentProps extends MuiCardContentProps {
    children: React.ReactNode;
}

export interface CardHeaderProps extends MuiCardHeaderProps {
    title?: string;
    description?: string;
}

export function Card({ children, ...props }: CardProps) {
    return <MuiCard {...props}>{children}</MuiCard>;
}

export function CardContent({ children, ...props }: CardContentProps) {
    return <MuiCardContent {...props}>{children}</MuiCardContent>;
}

export function CardHeader({ title, description, ...props }: CardHeaderProps) {
    return (
        <MuiCardHeader {...props}
            title={title ? <Typography variant="h6">{title}</Typography> : undefined}
            subheader={description}
        />
    );
}

export function CardTitle({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <Typography variant="h6" {...props}>{children}</Typography>;
}

export function CardDescription({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <Typography variant="body2" color="text.secondary" {...props}>{children}</Typography>;
}
