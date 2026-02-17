import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { StaticInfoScreen } from "../components/StaticInfoScreen";

type Props = NativeStackScreenProps<RootStackParamList, "OwnerGuide">;

export function OwnerGuideScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      title="Owner Guide"
      description="Best practices for listing, pricing, and managing your rentals."
      ctaLabel="List an item"
      onPressCta={() => navigation.navigate("CreateListing")}
    />
  );
}
