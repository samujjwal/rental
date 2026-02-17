import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Earnings">;

export function EarningsScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Earnings"
      description="Track your rental income and learn how to maximize earnings."
      ctaLabel="Go to dashboard"
      onPressCta={() => navigation.navigate("OwnerDashboard")}
    />
  );
}
