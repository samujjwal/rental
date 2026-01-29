import React from 'react';
import { Typography, TypographyProps } from '@mui/material';

export interface LabelProps extends TypographyProps {
    children: React.ReactNode;
}

export function Label({ children, ...props }: LabelProps) {
    return <Typography {...props}>{children}</Typography>;
}
