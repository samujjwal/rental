import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Cookies">;

export function CookiesScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Cookies Policy"
      description="Understand how cookies help us improve your rental experience."
      ctaLabel="Privacy policy"
      onPressCta={() => navigation.navigate("Privacy")}
    />
  );
}
