import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Press">;

export function PressScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Press"
      description="News, media resources, and announcements about GharBatai."
      ctaLabel="Contact press"
      onPressCta={() => navigation.navigate("Contact")}
    />
  );
}
