import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Help">;

export function HelpScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Help Center"
      description="Find answers, guides, and troubleshooting resources."
      ctaLabel="Contact support"
      onPressCta={() => navigation.navigate("Contact")}
    />
  );
}
