import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Privacy">;

export function PrivacyScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Privacy Policy"
      description="Learn how we collect, use, and protect your data."
      ctaLabel="Cookies policy"
      onPressCta={() => navigation.navigate("Cookies")}
    />
  );
}
