import React from 'react';
import { Card as MuiCard, CardProps as MuiCardProps } from '@mui/material';

export interface CardProps extends MuiCardProps {
    children: React.ReactNode;
}

export function Card({ children, ...props }: CardProps) {
    return <MuiCard {...props}>{children}</MuiCard>;
}
