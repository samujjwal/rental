import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Terms">;

export function TermsScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Terms of Service"
      description="Review the terms that govern use of the GharBatai platform."
      ctaLabel="Privacy policy"
      onPressCta={() => navigation.navigate("Privacy")}
    />
  );
}
