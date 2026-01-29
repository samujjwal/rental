import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps } from '@mui/material';

export interface ButtonProps extends MuiButtonProps {
    children: React.ReactNode;
}

export function Button({ children, ...props }: ButtonProps) {
    return <MuiButton {...props}>{children}</MuiButton>;
}
