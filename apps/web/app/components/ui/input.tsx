import React from "react";
import { TextField, TextFieldProps } from "@mui/material";

export type InputProps = TextFieldProps & {
  label?: string;
};

export function Input({ label, ...props }: InputProps) {
  return <TextField label={label} {...props} />;
}
