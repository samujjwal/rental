import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Safety">;

export function SafetyScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Safety"
      description="Safety guidelines and best practices for renters and owners."
      ctaLabel="Get support"
      onPressCta={() => navigation.navigate("Help")}
    />
  );
}
