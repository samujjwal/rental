import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "HowItWorks">;

export function HowItWorksScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="How It Works"
      description="Discover, book, and enjoy rentals with secure payments and trusted reviews."
      ctaLabel="Start searching"
      onPressCta={() => navigation.navigate("Main")}
    />
  );
}
